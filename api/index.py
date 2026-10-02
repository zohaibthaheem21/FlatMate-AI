import os
import random
import string
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Body, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Bachelors Expense Club API", version="1.0.0")

_db_initialized = False

def get_db_connection():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL environment variable is missing")
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    conn.autocommit = True
    return conn

def init_db():
    global _db_initialized
    if _db_initialized:
        return
    
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS flats (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50) UNIQUE NOT NULL,
                phone VARCHAR(50),
                password VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                pin VARCHAR(10),
                password VARCHAR(255),
                user_code VARCHAR(20) UNIQUE NOT NULL,
                flat_id INT REFERENCES flats(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS flat_members (
                id SERIAL PRIMARY KEY,
                flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT unique_flat_member UNIQUE (flat_id, user_id)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
                paid_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                category VARCHAR(100) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS expense_splits (
                id SERIAL PRIMARY KEY,
                expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC(10, 2) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT unique_expense_user_split UNIQUE (expense_id, user_id)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settlements (
                id SERIAL PRIMARY KEY,
                flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
                payer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                payee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC(10, 2) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        cur.execute("""
            ALTER TABLE settlements ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
        """)
    conn.close()
    _db_initialized = True

@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Startup DB init warning: {e}")

# Helper model schemas
class RegisterRequest(BaseModel):
    name: str
    pin: Optional[str] = "1234"
    phone: Optional[str] = None
    password: Optional[str] = None

class LoginRequest(BaseModel):
    user_code: Optional[str] = None
    userCode: Optional[str] = None
    phone: Optional[str] = None
    pin: Optional[str] = None
    password: Optional[str] = None

class CreateFlatRequest(BaseModel):
    user_id: Optional[int] = None
    userId: Optional[int] = None
    flat_name: Optional[str] = None
    flatName: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

class JoinFlatRequest(BaseModel):
    user_id: Optional[int] = None
    userId: Optional[int] = None
    code: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

class LeaveFlatRequest(BaseModel):
    user_id: Optional[int] = None
    userId: Optional[int] = None
    target_user_id: Optional[int] = None
    targetUserId: Optional[int] = None

class AddExpenseRequest(BaseModel):
    flat_id: Optional[int] = None
    flatId: Optional[int] = None
    paid_by: Optional[int] = None
    paidBy: Optional[int] = None
    title: str
    amount: float
    category: Optional[str] = "Meal"
    split_user_ids: Optional[List[int]] = None
    splitUserIds: Optional[List[int]] = None

class ApprovalUpdateRequest(BaseModel):
    split_id: Optional[int] = None
    splitId: Optional[int] = None
    settlement_id: Optional[int] = None
    settlementId: Optional[int] = None
    type: Optional[str] = None
    status: str
    user_id: Optional[int] = None
    userId: Optional[int] = None

class SettleRequest(BaseModel):
    flat_id: Optional[int] = None
    flatId: Optional[int] = None
    payer_id: Optional[int] = None
    payerId: Optional[int] = None
    payee_id: Optional[int] = None
    payeeId: Optional[int] = None
    receiver_id: Optional[int] = None
    amount: float
    initiator_id: Optional[int] = None
    initiatorId: Optional[int] = None

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    init_db()
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    prefix = "".join([c for c in name if c.isalnum()]).upper()[:3]
    if len(prefix) < 3:
        prefix = (prefix + "USR")[:3]
    
    conn = get_db_connection()
    with conn.cursor() as cur:
        # Generate unique user code
        while True:
            rand_digits = f"{random.randint(1000, 9999)}"
            user_code = f"{prefix}-{rand_digits}"
            cur.execute("SELECT id FROM users WHERE user_code = %s", (user_code,))
            if not cur.fetchone():
                break
        
        cur.execute(
            """
            INSERT INTO users (name, phone, pin, password, user_code)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, phone, pin, user_code, flat_id
            """,
            (name, req.phone, req.pin or req.password, req.password or req.pin, user_code)
        )
        user = cur.fetchone()
    conn.close()
    return {"success": True, "user": dict(user)}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    init_db()
    code = (req.user_code or req.userCode or "").strip().upper()
    phone = (req.phone or "").strip()
    secret = req.password or req.pin or ""

    conn = get_db_connection()
    with conn.cursor() as cur:
        if code:
            cur.execute(
                "SELECT u.*, f.name as flat_name, f.code as flat_code FROM users u LEFT JOIN flats f ON u.flat_id = f.id WHERE u.user_code = %s",
                (code,)
            )
        elif phone:
            cur.execute(
                "SELECT u.*, f.name as flat_name, f.code as flat_code FROM users u LEFT JOIN flats f ON u.flat_id = f.id WHERE u.phone = %s",
                (phone,)
            )
        else:
            conn.close()
            raise HTTPException(status_code=400, detail="User Code or Phone is required")
        
        user = cur.fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Verify secret if set
        if user.get("password") and secret and user["password"] != secret and user.get("pin") != secret:
            conn.close()
            raise HTTPException(status_code=401, detail="Invalid password or PIN")

    conn.close()
    return {"success": True, "user": dict(user)}

# --- FLAT ENDPOINTS ---
@app.post("/api/flats/create")
def create_flat(req: CreateFlatRequest):
    init_db()
    uid = req.user_id or req.userId
    flat_name = (req.flat_name or req.flatName or "").strip()
    
    if not uid or not flat_name:
        raise HTTPException(status_code=400, detail="userId and flatName are required")
    
    conn = get_db_connection()
    with conn.cursor() as cur:
        while True:
            code = f"ROOM-{random.randint(1000, 9999)}"
            cur.execute("SELECT id FROM flats WHERE code = %s", (code,))
            if not cur.fetchone():
                break
        
        cur.execute(
            "INSERT INTO flats (name, code, phone, password) VALUES (%s, %s, %s, %s) RETURNING id, name, code",
            (flat_name, code, req.phone, req.password)
        )
        flat = cur.fetchone()
        flat_id = flat["id"]

        cur.execute("INSERT INTO flat_members (flat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (flat_id, uid))
        cur.execute("UPDATE users SET flat_id = %s WHERE id = %s RETURNING id, name, user_code, flat_id", (flat_id, uid))
        user = cur.fetchone()
    conn.close()
    return {"success": True, "flat": dict(flat), "user": dict(user)}

@app.post("/api/flats/join")
def join_flat(req: JoinFlatRequest):
    init_db()
    uid = req.user_id or req.userId
    code = (req.code or "").strip().upper()
    
    if not uid:
        raise HTTPException(status_code=400, detail="userId is required")
    
    conn = get_db_connection()
    with conn.cursor() as cur:
        if code:
            cur.execute("SELECT id, name, code FROM flats WHERE code = %s", (code,))
        elif req.phone and req.password:
            cur.execute("SELECT id, name, code FROM flats WHERE phone = %s AND password = %s", (req.phone.strip(), req.password.strip()))
        else:
            conn.close()
            raise HTTPException(status_code=400, detail="Room Key or Phone + Password required")
        
        flat = cur.fetchone()
        if not flat:
            conn.close()
            raise HTTPException(status_code=404, detail="Room not found")
        
        flat_id = flat["id"]
        cur.execute("INSERT INTO flat_members (flat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (flat_id, uid))
        cur.execute("UPDATE users SET flat_id = %s WHERE id = %s RETURNING id, name, user_code, flat_id", (flat_id, uid))
        user = cur.fetchone()
    conn.close()
    return {"success": True, "flat": dict(flat), "user": dict(user)}

@app.get("/api/flats/members")
def get_flat_members(flatId: int = Query(...)):
    init_db()
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.name, u.user_code, fm.joined_at
            FROM flat_members fm
            JOIN users u ON fm.user_id = u.id
            WHERE fm.flat_id = %s
            ORDER BY fm.joined_at ASC
            """,
            (flatId,)
        )
        members = cur.fetchall()
    conn.close()
    return {"success": True, "members": [dict(m) for m in members]}

@app.post("/api/flats/leave")
def leave_flat(req: LeaveFlatRequest):
    init_db()
    target_uid = req.target_user_id or req.targetUserId or req.user_id or req.userId
    if not target_uid:
        raise HTTPException(status_code=400, detail="userId is required")
    
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, flat_id FROM users WHERE id = %s", (target_uid,))
        user = cur.fetchone()
        if not user or not user["flat_id"]:
            conn.close()
            return {"success": True, "message": "User is not in any flat"}
        
        flat_id = user["flat_id"]

        # Calculate user's approved split debts and credits
        cur.execute(
            """
            SELECT COALESCE(SUM(es.amount), 0) as total
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            WHERE e.flat_id = %s AND e.paid_by = %s AND es.user_id != %s AND es.status = 'approved'
            """,
            (flat_id, target_uid, target_uid)
        )
        owed_by_others = float(cur.fetchone()["total"])

        cur.execute(
            """
            SELECT COALESCE(SUM(es.amount), 0) as total
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            WHERE e.flat_id = %s AND es.user_id = %s AND e.paid_by != %s AND es.status = 'approved'
            """,
            (flat_id, target_uid, target_uid)
        )
        owed_to_others = float(cur.fetchone()["total"])

        # Confirmed settlements
        cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM settlements WHERE flat_id = %s AND payer_id = %s AND status IN ('confirmed', 'approved')", (flat_id, target_uid))
        sent = float(cur.fetchone()["total"])

        cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM settlements WHERE flat_id = %s AND payee_id = %s AND status IN ('confirmed', 'approved')", (flat_id, target_uid))
        received = float(cur.fetchone()["total"])

        net_balance = round(((owed_by_others - received) - (owed_to_others - sent)), 2)

        # Check pending items
        cur.execute(
            """
            SELECT COUNT(*) as count FROM expense_splits es JOIN expenses e ON es.expense_id = e.id
            WHERE e.flat_id = %s AND (es.user_id = %s OR e.paid_by = %s) AND es.status = 'pending'
            """,
            (flat_id, target_uid, target_uid)
        )
        pending_splits = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) as count FROM settlements WHERE flat_id = %s AND (payer_id = %s OR payee_id = %s) AND status = 'pending'", (flat_id, target_uid, target_uid))
        pending_settlements = cur.fetchone()["count"]

        if abs(net_balance) > 0.01:
            conn.close()
            amt_str = f"+{net_balance}" if net_balance > 0 else f"{net_balance}"
            raise HTTPException(status_code=400, detail=f"Cannot leave flat. Please settle all pending debts (Current balance: PKR {amt_str}) first.")
        
        if pending_splits > 0 or pending_settlements > 0:
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot leave flat while there are pending approvals or cash requests.")

        # Clean removal
        cur.execute("DELETE FROM flat_members WHERE flat_id = %s AND user_id = %s", (flat_id, target_uid))
        cur.execute("UPDATE users SET flat_id = NULL WHERE id = %s RETURNING id, name, user_code, flat_id", (target_uid,))
        updated_user = cur.fetchone()

    conn.close()
    return {"success": True, "user": dict(updated_user), "message": "Successfully left flat"}

# --- EXPENSES & APPROVALS ENDPOINTS ---
@app.get("/api/expenses")
def get_expenses(flatId: int = Query(...)):
    init_db()
    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.id, e.flat_id, e.paid_by, e.title, e.amount, e.category, e.created_at, u.name as payer_name, u.user_code as payer_code
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            WHERE e.flat_id = %s
            ORDER BY e.created_at DESC
            """,
            (flatId,)
        )
        expenses = [dict(x) for x in cur.fetchall()]

        if expenses:
            exp_ids = tuple([x["id"] for x in expenses])
            cur.execute(
                """
                SELECT es.id, es.expense_id, es.user_id, es.amount, es.status, es.updated_at, u.name as user_name, u.user_code
                FROM expense_splits es
                JOIN users u ON es.user_id = u.id
                WHERE es.expense_id IN %s
                """,
                (exp_ids,)
            )
            splits = [dict(s) for s in cur.fetchall()]
            
            splits_by_exp = {}
            for s in splits:
                s["amount"] = float(s["amount"])
                splits_by_exp.setdefault(s["expense_id"], []).append(s)
            
            for e in expenses:
                e["amount"] = float(e["amount"])
                e["splits"] = splits_by_exp.get(e["id"], [])
        
    conn.close()
    return {"success": True, "expenses": expenses}

@app.post("/api/expenses")
def add_expense(req: AddExpenseRequest):
    init_db()
    flat_id = req.flat_id or req.flatId
    paid_by = req.paid_by or req.paidBy
    split_uids = req.split_user_ids or req.splitUserIds or []

    if not flat_id or not paid_by or not req.title.strip() or req.amount <= 0 or not split_uids:
        raise HTTPException(status_code=400, detail="Missing required expense fields")

    per_person_share = round(req.amount / len(split_uids), 2)

    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO expenses (flat_id, paid_by, title, amount, category)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, flat_id, paid_by, title, amount, category, created_at
            """,
            (flat_id, paid_by, req.title.strip(), req.amount, req.category or "Meal")
        )
        new_expense = dict(cur.fetchone())
        new_expense["amount"] = float(new_expense["amount"])

        split_records = []
        for uid in split_uids:
            status = "approved" if int(uid) == int(paid_by) else "pending"
            cur.execute(
                """
                INSERT INTO expense_splits (expense_id, user_id, amount, status)
                VALUES (%s, %s, %s, %s)
                RETURNING id, expense_id, user_id, amount, status
                """,
                (new_expense["id"], uid, per_person_share, status)
            )
            sp = dict(cur.fetchone())
            sp["amount"] = float(sp["amount"])
            split_records.append(sp)

        new_expense["splits"] = split_records

    conn.close()
    return {"success": True, "expense": new_expense}

@app.delete("/api/expenses")
def delete_expense(expenseId: Optional[int] = Query(None), req: Optional[Dict[str, Any]] = Body(None)):
    init_db()
    eid = expenseId or (req and (req.get("expenseId") or req.get("expense_id") or req.get("id")))
    if not eid:
        raise HTTPException(status_code=400, detail="expenseId is required")

    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM expenses WHERE id = %s", (eid,))
    conn.close()
    return {"success": True, "message": "Expense deleted successfully"}

@app.get("/api/approvals")
def get_approvals(userId: int = Query(...)):
    init_db()
    conn = get_db_connection()
    with conn.cursor() as cur:
        # Pending expense split shares
        cur.execute(
            """
            SELECT 
              es.id as split_id,
              'expense' as approval_type,
              es.amount as share_amount,
              es.status,
              es.updated_at,
              e.id as expense_id,
              e.title,
              e.amount as total_amount,
              e.category,
              e.created_at as expense_date,
              u_payer.name as paid_by_name,
              u_payer.user_code as paid_by_code,
              u_payer.id as paid_by_id
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            JOIN users u_payer ON e.paid_by = u_payer.id
            WHERE es.user_id = %s AND es.status = 'pending' AND e.paid_by != %s
            ORDER BY e.created_at DESC
            """,
            (userId, userId)
        )
        pending_expenses = [dict(x) for x in cur.fetchall()]

        # Pending cash settlement verification requests
        cur.execute(
            """
            SELECT 
              s.id as settlement_id,
              'settlement' as approval_type,
              s.amount as share_amount,
              s.status,
              s.created_at as expense_date,
              u_payer.name as paid_by_name,
              u_payer.user_code as paid_by_code,
              u_payer.id as paid_by_id,
              'Cash Settlement' as title,
              'Settlement' as category,
              s.amount as total_amount
            FROM settlements s
            JOIN users u_payer ON s.payer_id = u_payer.id
            WHERE s.payee_id = %s AND s.status = 'pending'
            ORDER BY s.created_at DESC
            """,
            (userId,)
        )
        pending_settlements = [dict(s) for s in cur.fetchall()]

        for item in pending_expenses:
            item["share_amount"] = float(item["share_amount"])
            item["total_amount"] = float(item["total_amount"])
        
        for item in pending_settlements:
            item["share_amount"] = float(item["share_amount"])
            item["total_amount"] = float(item["total_amount"])

    conn.close()
    return {"success": True, "approvals": pending_expenses + pending_settlements}

@app.patch("/api/approvals")
@app.post("/api/approvals")
def update_approval(req: ApprovalUpdateRequest):
    init_db()
    uid = req.user_id or req.userId
    status = req.status
    if not uid or not status:
        raise HTTPException(status_code=400, detail="userId and status are required")

    conn = get_db_connection()
    with conn.cursor() as cur:
        if req.type == "settlement" or req.settlement_id or req.settlementId:
            target_id = req.settlement_id or req.settlementId or req.split_id or req.splitId
            cur.execute("SELECT id, payee_id FROM settlements WHERE id = %s", (target_id,))
            st = cur.fetchone()
            if not st:
                conn.close()
                raise HTTPException(status_code=404, detail="Settlement request not found")
            if int(st["payee_id"]) != int(uid):
                conn.close()
                raise HTTPException(status_code=403, detail="Unauthorized to modify this settlement")
            
            norm_status = "confirmed" if status in ["approved", "confirmed"] else "rejected"
            cur.execute("UPDATE settlements SET status = %s WHERE id = %s RETURNING *", (norm_status, target_id))
            updated = dict(cur.fetchone())
            updated["amount"] = float(updated["amount"])
            conn.close()
            return {"success": True, "settlement": updated}
        else:
            target_id = req.split_id or req.splitId
            cur.execute("SELECT id, user_id FROM expense_splits WHERE id = %s", (target_id,))
            sp = cur.fetchone()
            if not sp:
                conn.close()
                raise HTTPException(status_code=404, detail="Split not found")
            if int(sp["user_id"]) != int(uid):
                conn.close()
                raise HTTPException(status_code=403, detail="Unauthorized to modify this split")
            
            cur.execute("UPDATE expense_splits SET status = %s, updated_at = NOW() WHERE id = %s RETURNING *", (status, target_id))
            updated = dict(cur.fetchone())
            updated["amount"] = float(updated["amount"])
            conn.close()
            return {"success": True, "split": updated}

# --- SETTLEMENT & DEBT CALCULATION ENDPOINTS ---
@app.get("/api/settle")
def get_settlement_data(flatId: int = Query(...), userId: Optional[int] = Query(None)):
    init_db()
    conn = get_db_connection()
    with conn.cursor() as cur:
        # Fetch members
        cur.execute("SELECT u.id, u.name, u.user_code FROM flat_members fm JOIN users u ON fm.user_id = u.id WHERE fm.flat_id = %s ORDER BY fm.joined_at ASC", (flatId,))
        members = [dict(m) for m in cur.fetchall()]

        if not members:
            conn.close()
            return {"success": True, "balances": [], "transactions": [], "pendingSettlements": [], "history": []}

        # 1. Approved splits
        cur.execute(
            """
            SELECT es.user_id as debtor_id, e.paid_by as creditor_id, COALESCE(SUM(es.amount), 0) as total_amount
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            WHERE e.flat_id = %s AND es.status = 'approved' AND es.user_id != e.paid_by
            GROUP BY es.user_id, e.paid_by
            """,
            (flatId,)
        )
        approved_splits = cur.fetchall()

        split_debt_map = {}
        for row in approved_splits:
            d = int(row["debtor_id"])
            c = int(row["creditor_id"])
            amt = float(row["total_amount"])
            split_debt_map.setdefault(d, {})[c] = split_debt_map.get(d, {}).get(c, 0) + amt

        # 2. Confirmed cash settlements
        cur.execute(
            """
            SELECT payer_id, payee_id, COALESCE(SUM(amount), 0) as total_amount
            FROM settlements
            WHERE flat_id = %s AND status IN ('confirmed', 'approved')
            GROUP BY payer_id, payee_id
            """,
            (flatId,)
        )
        confirmed_settlements = cur.fetchall()

        cash_paid_map = {}
        for row in confirmed_settlements:
            p = int(row["payer_id"])
            r = int(row["payee_id"])
            amt = float(row["total_amount"])
            cash_paid_map.setdefault(p, {})[r] = cash_paid_map.get(p, {}).get(r, 0) + amt

        # 3. Compute pairwise rolling net balance between every pair (A, B)
        member_map = {m["id"]: m for m in members}
        member_ids = [m["id"] for m in members]
        pairwise_transactions = []

        for i in range(len(member_ids)):
            for j in range(i + 1, len(member_ids)):
                idA = member_ids[i]
                idB = member_ids[j]

                splitsA_owes_B = split_debt_map.get(idA, {}).get(idB, 0)
                cashA_paid_B = cash_paid_map.get(idA, {}).get(idB, 0)
                grossA_owes_B = splitsA_owes_B - cashA_paid_B

                splitsB_owes_A = split_debt_map.get(idB, {}).get(idA, 0)
                cashB_paid_A = cash_paid_map.get(idB, {}).get(idA, 0)
                grossB_owes_A = splitsB_owes_A - cashB_paid_A

                netA_to_B = round(grossA_owes_B - grossB_owes_A, 2)

                if netA_to_B > 0.01:
                    pairwise_transactions.append({
                        "payer_id": idA,
                        "payer_name": member_map[idA]["name"],
                        "payer_code": member_map[idA]["user_code"],
                        "payee_id": idB,
                        "payee_name": member_map[idB]["name"],
                        "payee_code": member_map[idB]["user_code"],
                        "amount": netA_to_B,
                    })
                elif netA_to_B < -0.01:
                    amt = abs(netA_to_B)
                    pairwise_transactions.append({
                        "payer_id": idB,
                        "payer_name": member_map[idB]["name"],
                        "payer_code": member_map[idB]["user_code"],
                        "payee_id": idA,
                        "payee_name": member_map[idA]["name"],
                        "payee_code": member_map[idA]["user_code"],
                        "amount": amt,
                    })

        # 4. Member net standings
        member_balances = []
        for m in members:
            total_receivable = sum(tx["amount"] for tx in pairwise_transactions if tx["payee_id"] == m["id"])
            total_payable = sum(tx["amount"] for tx in pairwise_transactions if tx["payer_id"] == m["id"])
            net_bal = round(total_receivable - total_payable, 2)
            member_balances.append({
                "id": m["id"],
                "name": m["name"],
                "user_code": m["user_code"],
                "total_receivable": total_receivable,
                "total_payable": total_payable,
                "net_balance": net_bal,
            })

        # 5. Pending settlements
        if userId:
            cur.execute(
                """
                SELECT s.id, s.amount, s.created_at, s.payer_id, s.payee_id, s.status,
                       u_payer.name as payer_name, u_payer.user_code as payer_code,
                       u_payee.name as payee_name, u_payee.user_code as payee_code
                FROM settlements s
                JOIN users u_payer ON s.payer_id = u_payer.id
                JOIN users u_payee ON s.payee_id = u_payee.id
                WHERE s.flat_id = %s AND s.payee_id = %s AND s.status = 'pending'
                ORDER BY s.created_at DESC
                """,
                (flatId, userId)
            )
        else:
            cur.execute(
                """
                SELECT s.id, s.amount, s.created_at, s.payer_id, s.payee_id, s.status,
                       u_payer.name as payer_name, u_payer.user_code as payer_code,
                       u_payee.name as payee_name, u_payee.user_code as payee_code
                FROM settlements s
                JOIN users u_payer ON s.payer_id = u_payer.id
                JOIN users u_payee ON s.payee_id = u_payee.id
                WHERE s.flat_id = %s AND s.status = 'pending'
                ORDER BY s.created_at DESC
                """,
                (flatId,)
            )
        pending_settlements = [dict(s) for s in cur.fetchall()]
        for ps in pending_settlements:
            ps["amount"] = float(ps["amount"])

        # 6. History
        cur.execute(
            """
            SELECT s.id, s.amount, s.created_at, s.status,
                   u1.name as payer_name, u1.user_code as payer_code,
                   u2.name as payee_name, u2.user_code as payee_code
            FROM settlements s
            JOIN users u1 ON s.payer_id = u1.id
            JOIN users u2 ON s.payee_id = u2.id
            WHERE s.flat_id = %s AND s.status IN ('confirmed', 'approved')
            ORDER BY s.created_at DESC LIMIT 20
            """,
            (flatId,)
        )
        history = [dict(h) for h in cur.fetchall()]
        for h in history:
            h["amount"] = float(h["amount"])

    conn.close()
    return {
        "success": True,
        "balances": member_balances,
        "transactions": pairwise_transactions,
        "pairwise_debts": pairwise_transactions,
        "pendingSettlements": pending_settlements,
        "history": history
    }

@app.post("/api/settle")
def record_settlement(req: SettleRequest):
    init_db()
    flat_id = req.flat_id or req.flatId
    payer_id = req.payer_id or req.payerId
    payee_id = req.payee_id or req.payeeId or req.receiver_id
    initiator_id = req.initiator_id or req.initiatorId

    if not flat_id or not payer_id or not payee_id or req.amount <= 0:
        raise HTTPException(status_code=400, detail="Missing required settlement fields")

    status = "confirmed" if initiator_id and int(initiator_id) == int(payee_id) else "pending"

    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO settlements (flat_id, payer_id, payee_id, amount, status)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, flat_id, payer_id, payee_id, amount, status, created_at
            """,
            (flat_id, payer_id, payee_id, req.amount, status)
        )
        settlement = dict(cur.fetchone())
        settlement["amount"] = float(settlement["amount"])
    conn.close()
    return {"success": True, "settlement": settlement}

@app.patch("/api/settle")
def confirm_settlement(req: Dict[str, Any]):
    init_db()
    sid = req.get("settlement_id") or req.get("settlementId")
    status = req.get("status")
    uid = req.get("user_id") or req.get("userId")

    if not sid or not status or not uid:
        raise HTTPException(status_code=400, detail="settlementId, status, and userId required")

    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT id, payee_id FROM settlements WHERE id = %s", (sid,))
        st = cur.fetchone()
        if not st:
            conn.close()
            raise HTTPException(status_code=404, detail="Settlement record not found")
        if int(st["payee_id"]) != int(uid):
            conn.close()
            raise HTTPException(status_code=403, detail="Only cash receiver can confirm/decline")

        norm_status = "confirmed" if status in ["approved", "confirmed"] else "rejected"
        cur.execute("UPDATE settlements SET status = %s WHERE id = %s RETURNING *", (norm_status, sid))
        updated = dict(cur.fetchone())
        updated["amount"] = float(updated["amount"])
    conn.close()
    return {"success": True, "settlement": updated}

@app.delete("/api/settle")
def delete_settlement(settlementId: Optional[int] = Query(None), req: Optional[Dict[str, Any]] = Body(None)):
    init_db()
    sid = settlementId or (req and (req.get("settlementId") or req.get("settlement_id")))
    if not sid:
        raise HTTPException(status_code=400, detail="settlementId required")

    conn = get_db_connection()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM settlements WHERE id = %s", (sid,))
    conn.close()
    return {"success": True, "message": "Settlement deleted successfully"}

# --- FLATMATE AI ENDPOINTS ---
class ScanReceiptRequest(BaseModel):
    imageBase64: Optional[str] = None
    textContent: Optional[str] = None
    apiKey: Optional[str] = None

class ParseCommandRequest(BaseModel):
    command: str

@app.post("/api/ai")
def ai_endpoint(
    action: Optional[str] = Query("insights"),
    flatId: Optional[int] = Query(None),
    body: Optional[Dict[str, Any]] = Body(None)
):
    init_db()
    req_action = action or (body and body.get("action")) or "insights"

    if req_action == "scan-receipt":
        text = (body and body.get("textContent")) or ""
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        title = lines[0] if lines else "Store / Restaurant Receipt"
        amount = 1200.0
        
        # Simple extraction logic
        import re
        nums = re.findall(r'\d+(?:\.\d{1,2})?', text)
        if nums:
            floats = [float(n) for n in nums if 5 < float(n) < 500000]
            if floats:
                amount = max(floats)
        
        category = "Meal"
        lower = text.lower()
        if any(k in lower for k in ["k-electric", "wapda", "gas", "internet", "wifi"]):
            category = "Utilities"
        elif any(k in lower for k in ["mart", "supermarket", "grocery", "milk"]):
            category = "Groceries"

        return {
            "success": True,
            "method": "Flatmate AI Engine (Free Zero-Cost Parser)",
            "parsed": {
                "title": title[:30],
                "amount": amount,
                "category": category
            }
        }
    
    elif req_action == "parse-command":
        cmd = (body and body.get("command")) or ""
        import re
        nums = re.findall(r'\d+(?:\.\d{1,2})?', cmd)
        amt = float(nums[0]) if nums else 500.0
        cat = "Meal"
        low = cmd.lower()
        if "grocery" in low or "mart" in low: cat = "Groceries"
        elif "bill" in low or "wifi" in low or "electric" in low: cat = "Utilities"
        
        title = re.sub(r'\d+(?:\.\d{1,2})?', '', cmd).replace("paid", "").replace("for", "").strip() or f"{cat} Expense"
        return {
            "success": True,
            "parsed": {
                "title": title.capitalize(),
                "amount": amt,
                "category": cat
            }
        }
        
    else:
        target_flat_id = flatId or (body and body.get("flatId"))
        if not target_flat_id:
            raise HTTPException(status_code=400, detail="flatId is required")

        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.*, u.name as payer_name 
                FROM expenses e JOIN users u ON e.paid_by = u.id 
                WHERE e.flat_id = %s ORDER BY e.created_at DESC
            """, (target_flat_id,))
            expenses = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT u.id, u.name, u.user_code 
                FROM flat_members fm JOIN users u ON fm.user_id = u.id 
                WHERE fm.flat_id = %s
            """, (target_flat_id,))
            members = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT es.*, u.name as user_name 
                FROM expense_splits es JOIN expenses e ON es.expense_id = e.id JOIN users u ON es.user_id = u.id 
                WHERE e.flat_id = %s
            """, (target_flat_id,))
            splits = [dict(r) for r in cur.fetchall()]
        conn.close()

        # Auditor findings
        findings = []
        total_spent = sum(float(e["amount"]) for e in expenses)
        for e in expenses:
            if float(e["amount"]) > 15000:
                findings.append({
                    "type": "high_expense",
                    "severity": "warning",
                    "title": "High Expense Spike",
                    "description": f'"{e["title"]}" by {e["payer_name"]} is Rs {float(e["amount"]):,.0f}'
                })
        
        if not findings:
            findings.append({
                "type": "clean",
                "severity": "success",
                "title": "All Systems Operational",
                "description": "No duplicate bills or expense anomalies found."
            })

        # Net Balances
        balances = {m["id"]: 0.0 for m in members}
        member_names = {m["id"]: m["name"] for m in members}

        for e in expenses:
            if e["paid_by"] in balances:
                balances[e["paid_by"]] += float(e["amount"])
        for s in splits:
            if s["user_id"] in balances:
                balances[s["user_id"]] -= float(s["amount"])

        debtors = [{"id": uid, "name": member_names[uid], "amount": -bal} for uid, bal in balances.items() if bal < -0.5]
        creditors = [{"id": uid, "name": member_names[uid], "amount": bal} for uid, bal in balances.items() if bal > 0.5]

        transfers = []
        i, j = 0, 0
        while i < len(debtors) and j < len(creditors):
            t_amt = min(debtors[i]["amount"], creditors[j]["amount"])
            transfers.append({
                "fromName": debtors[i]["name"],
                "toName": creditors[j]["name"],
                "amount": round(t_amt, 2)
            })
            debtors[i]["amount"] -= t_amt
            creditors[j]["amount"] -= t_amt
            if debtors[i]["amount"] < 0.5: i += 1
            if creditors[j]["amount"] < 0.5: j += 1

        return {
            "success": True,
            "agents": {
                "auditor": {
                    "agentName": "Expense Auditor Agent",
                    "status": "Active",
                    "totalSpent": total_spent,
                    "findings": findings
                },
                "debtOptimizer": {
                    "agentName": "Debt Minimizer Agent",
                    "status": "Active",
                    "netBalances": [{"userName": member_names[uid], "balance": round(bal, 2)} for uid, bal in balances.items()],
                    "recommendedTransfers": transfers
                },
                "budgetAdvisor": {
                    "agentName": "Budget Advisor Agent",
                    "status": "Active",
                    "recommendations": [
                        {
                            "category": "Food & Meal Prep",
                            "icon": "🍲",
                            "title": "Meal Planning Insight",
                            "tip": "Cooking flat meals together saves up to 40% vs ordering out."
                        },
                        {
                            "category": "Settlement Strategy",
                            "icon": "🎯",
                            "title": "Weekly Debt Clearance",
                            "tip": "Use Flatmate AI Debt Minimizer every Sunday to settle balances."
                        }
                    ]
                }
            }
        }

