import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bachelor_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [flat, setFlat] = useState(() => {
    try {
      const saved = localStorage.getItem('bachelor_flat_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [members, setMembers] = useState([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem('bachelor_user_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('bachelor_user_session');
    }
  }, [user]);

  useEffect(() => {
    if (flat) {
      localStorage.setItem('bachelor_flat_session', JSON.stringify(flat));
    } else {
      localStorage.removeItem('bachelor_flat_session');
    }
  }, [flat]);

  const syncSession = useCallback(async (userId) => {
    const uidToUse = userId || user?.id;
    if (!uidToUse) return;

    try {
      const res = await fetch(`/api/auth/me?userId=${uidToUse}`);
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user) {
          setUser(data.user);
        }
        setFlat(data.flat || null);
      }
    } catch (err) {
      console.error('Failed to sync session from backend:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      syncSession(user.id);
    }
  }, []);

  const refreshMembers = useCallback(async (flatId) => {
    const idToUse = flatId || flat?.id;
    if (!idToUse) return;

    try {
      const res = await fetch(`/api/flats/members?flatId=${idToUse}`);
      const data = await res.json();
      if (data.success) {
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  }, [flat?.id]);

  const refreshPendingApprovalsCount = useCallback(async (userId) => {
    const idToUse = userId || user?.id;
    if (!idToUse) return;

    try {
      const res = await fetch(`/api/approvals?userId=${idToUse}`);
      const data = await res.json();
      if (data.success) {
        setPendingApprovalsCount((data.approvals || []).length);
      }
    } catch (err) {
      console.error('Failed to fetch approvals count:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.flat_id) {
      refreshMembers(user.flat_id);
    } else {
      setMembers([]);
    }
    if (user?.id) {
      refreshPendingApprovalsCount(user.id);
    }

    if (!user?.id) return;
    const timer = setInterval(() => {
      if (user?.flat_id) refreshMembers(user.flat_id);
      if (user?.id) refreshPendingApprovalsCount(user.id);
      syncSession(user.id);
    }, 3000);

    return () => clearInterval(timer);
  }, [user?.flat_id, user?.id, refreshMembers, refreshPendingApprovalsCount, syncSession]);

  const registerUser = async (name, phone, password) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      setUser(data.user);
      setFlat(null);
      showToast(`Welcome ${data.user.name}! Your Unique ID is ${data.user.user_code}`, 'success');
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (phoneOrCode, password) => {
    setLoading(true);
    try {
      const cleaned = phoneOrCode.trim();
      const isCode = /^[A-Za-z]{3}-\d{4}$/.test(cleaned);
      const payload = isCode
        ? { userCode: cleaned, password }
        : { phone: cleaned, password };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed. Check your phone/user code and password.');
      }

      const loggedInUser = {
        id: data.user.id,
        name: data.user.name,
        phone: data.user.phone,
        user_code: data.user.user_code,
        flat_id: data.user.flat_id,
      };
      setUser(loggedInUser);

      if (data.user.flat_id && data.user.flat_name) {
        const flatData = {
          id: data.user.flat_id,
          name: data.user.flat_name,
          code: data.user.flat_code,
        };
        setFlat(flatData);
        refreshMembers(data.user.flat_id);
      } else {
        setFlat(null);
      }

      showToast(`Welcome back, ${loggedInUser.name}!`, 'success');
      return loggedInUser;
    } finally {
      setLoading(false);
    }
  };

  const createFlat = async (roomData) => {
    if (!user) throw new Error('Not logged in. Please log in first.');
    setLoading(true);
    try {
      const payload = typeof roomData === 'string' 
        ? { userId: user.id, flatName: roomData }
        : { userId: user.id, ...roomData };

      const res = await fetch('/api/flats/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create room.');
      }

      setFlat(data.flat);
      setUser(data.user);
      refreshMembers(data.flat.id);
      showToast(`Room "${data.flat.name}" created! Unique Room Key: ${data.flat.code}`, 'success');
      return data.flat;
    } finally {
      setLoading(false);
    }
  };

  const joinFlat = async (joinPayload) => {
    if (!user) throw new Error('Not logged in. Please log in first.');
    setLoading(true);
    try {
      const payload = typeof joinPayload === 'string'
        ? { userId: user.id, code: joinPayload }
        : { userId: user.id, ...joinPayload };

      const res = await fetch('/api/flats/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to join room.');
      }

      setFlat(data.flat);
      setUser(data.user);
      refreshMembers(data.flat.id);
      showToast(`Joined "${data.flat.name}" successfully!`, 'success');
      return data.flat;
    } finally {
      setLoading(false);
    }
  };

  const leaveFlat = async (targetUserId) => {
    if (!user) return false;
    const uidToLeave = targetUserId || user.id;
    const isSelf = Number(uidToLeave) === Number(user.id);

    setLoading(true);
    try {
      const res = await fetch('/api/flats/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUserId: uidToLeave }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to leave room.');
      }

      if (isSelf) {
        setFlat(null);
        setUser(data.user);
        setMembers([]);
        setPendingApprovalsCount(0);
        localStorage.removeItem('bachelor_flat_session');
        showToast('Left room successfully.', 'info');
      } else {
        refreshMembers(flat?.id);
        showToast('Member removed cleanly from room.', 'success');
      }
      return true;
    } catch (err) {
      showToast(err.message || 'Error leaving room', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setFlat(null);
    setMembers([]);
    setPendingApprovalsCount(0);
    localStorage.removeItem('bachelor_user_session');
    localStorage.removeItem('bachelor_flat_session');
    showToast('Logged out successfully', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        flat,
        members,
        pendingApprovalsCount,
        loading,
        toastMessage,
        showToast,
        registerUser,
        loginUser,
        createFlat,
        joinFlat,
        leaveFlat,
        logout,
        refreshMembers,
        refreshPendingApprovalsCount,
        syncSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
