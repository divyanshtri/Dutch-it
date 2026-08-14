import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Account() {
  const { user, logout, updateProfile } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.fullName);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState(null);

  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // Click-outside close — standard pattern for popovers
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowPhotoMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSaveName() {
    if (!nameInput.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateProfile({ fullName: nameInput.trim() });
      setIsEditingName(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setNameInput(user.fullName);
    setIsEditingName(false);
    setError(null);
  }

  function handlePhotoFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }

    setError(null);
    setIsUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await updateProfile({ photoURL: reader.result });
      } catch (err) {
        setError(err.message);
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.onerror = () => {
      setError('Could not read that image file.');
      setIsUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleRemovePhoto() {
    setIsUploadingPhoto(true);
    setError(null);
    try {
      await updateProfile({ photoURL: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  return (
    <section>
      <div className="section-header section-header--plain">
        <h2 className="section-title">Account</h2>
      </div>

      <div className="account-photo-block">
        <div className="account-photo-wrap" ref={menuRef}>
          <Avatar user={user} size={88} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handlePhotoFile(e.target.files[0]);
              setShowPhotoMenu(false);
            }}
          />
          <button
            className="photo-edit-btn"
            onClick={() => setShowPhotoMenu((v) => !v)}
            aria-label="Edit photo"
          >
            <PencilIcon />
          </button>

          {showPhotoMenu && (
            <div className="photo-edit-menu">
              <button
                onClick={() => {
                  fileInputRef.current.click();
                }}
                disabled={isUploadingPhoto}
              >
                Change Photo
              </button>
              {user.photoURL && (
                <button
                  onClick={() => {
                    handleRemovePhoto();
                    setShowPhotoMenu(false);
                  }}
                  disabled={isUploadingPhoto}
                >
                  Remove Photo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="balances-list">
        <div className="balance-row">
          <span className="balance-row__names">Name</span>
          {isEditingName ? (
            <span className="account-edit-row">
              <input
                className="form-input form-input--compact"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
              />
              <button
                className="btn btn--primary btn--small"
                onClick={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                className="btn btn--ghost btn--small"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </span>
          ) : (
            <span className="account-edit-row">
              <span>{user.fullName}</span>
              <button
                className="icon-btn"
                onClick={() => setIsEditingName(true)}
                title="Edit name"
                aria-label="Edit name"
              >
                <PencilIcon />
              </button>
            </span>
          )}
        </div>
        <div className="balance-row">
          <span className="balance-row__names">Email</span>
          <span>{user.email}</span>
        </div>
        <div className="balance-row">
          <span className="balance-row__names">Phone</span>
          <span>{user.phoneNumber}</span>
        </div>
      </div>

      {error && <p className="status-text status-text--error">{error}</p>}

      <div className="account-footer">
        <button className="btn btn--ghost btn--nav" onClick={logout}>
          Log Out
        </button>
      </div>
    </section>
  );
}

export default Account;