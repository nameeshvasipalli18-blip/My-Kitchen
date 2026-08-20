import { themes } from '../themes/themes';
import api from '../../api.js';
import { useRef, useState } from 'react';
import { FaEdit, FaPlus, FaTimes, FaTrash, FaUsers } from 'react-icons/fa';
import './Participants.css';

export const Participants = ({
  kitchenId,
  initialInputs,
  setInitialInputs,
  setParticipants,
  memberDetails = [],
  refreshKitchenMembers,
  splitBetween,
  setSplitBetween,
  initialInputsLocked,
  setInitialInputsLocked,
  inputRef,
  itemNameRef,
  onAddParticipantModeChange,
  isMenuOpen,
  showMenuToggle = true,
}) => {
  const [newParticipant, setNewParticipant] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteError, setInviteError] = useState('');
  const unlockedSectionRef = useRef(null);

  const safeInitialInputs = Array.isArray(initialInputs) ? initialInputs : [];
  const participantsVisible = isMenuOpen ?? (!initialInputsLocked || isParticipantsOpen);

  const syncParticipantThemes = (names) => {
    setInitialInputs(names);
    setParticipants(names.map((name, index) => ({ name, theme: themes[index % themes.length] })));
  };

  if (kitchenId) {
    const deleteMember = async (membershipId) => {
      try {
        await api.delete(`/kitchens/${kitchenId}/members/${membershipId}`);
        await refreshKitchenMembers?.();
      } catch (error) {
        setInviteError(error.response?.data?.detail || 'Unable to remove member.');
      }
    };

    const addMember = async (event) => {
      event.preventDefault();
      if (!inviteIdentifier.trim()) {
        return;
      }
      try {
        await api.post(`/kitchens/${kitchenId}/members`, { identifier: inviteIdentifier.trim(), role: 'member' });
        setInviteIdentifier('');
        setInviteError('');
        await refreshKitchenMembers?.();
      } catch (error) {
        setInviteError(error.response?.data?.detail || 'Unable to add member.');
      }
    };

    return (
      <div className={`participants participants-locked${participantsVisible ? '' : ' participants-collapsed'}`}>
        {showMenuToggle && (
          <button
            className="participants-toggle"
            type="button"
            title={isParticipantsOpen ? 'Hide kitchen members' : 'Show kitchen members'}
            aria-label={isParticipantsOpen ? 'Hide kitchen members' : 'Show kitchen members'}
            aria-expanded={isParticipantsOpen}
            onClick={() => setIsParticipantsOpen((open) => !open)}
          >
            <FaUsers aria-hidden="true" />
            <span className="participants-count">{memberDetails.length}</span>
          </button>
        )}
        {participantsVisible && (
          <>
            <div className="participants-unlocked participants-unlocked-centered">
              <h3>Kitchen members</h3>
              <form className="participants-inputs" onSubmit={addMember}>
                <label>Invite by email or username</label>
                <input value={inviteIdentifier} onChange={(event) => setInviteIdentifier(event.target.value)} placeholder="alice@example.com or alice" />
                <button className="lock-button" type="submit">
                  <FaPlus aria-hidden="true" /> Add member
                </button>
                {inviteError && <p className="recent-trips-empty">{inviteError}</p>}
              </form>
            </div>
            <div className="participants-list">
              <div className="locked-inputs">
                {memberDetails.map((member, index) => (
                  <div key={member.membershipId} className="locked-participant">
                    <button
                      className="lock-button"
                      style={{
                        '--primary': themes[index % themes.length].primary,
                        '--background': themes[index % themes.length].background,
                        '--border': themes[index % themes.length].border,
                        '--shadow': themes[index % themes.length].shadow,
                      }}
                    >
                      {member.username}
                    </button>
                    <div className="participant-actions">
                      <span className="participant-role">{member.role}</span>
                      <button
                        type="button"
                        className="participant-action participant-action-delete"
                        title={`Remove ${member.username}`}
                        aria-label={`Remove ${member.username}`}
                        onClick={() => deleteMember(member.membershipId)}
                      >
                        <FaTrash aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const generateInputs = () => {
    const numPeople = Number(splitBetween);
    if (!Number.isInteger(numPeople) || numPeople <= 0) {
      setInitialInputs([]);
      return;
    }

    setInitialInputs((prev) => Array.from({ length: numPeople }, (_, i) => prev[i] ?? ''));
  };

  const lockParticipants = () => {
    onAddParticipantModeChange?.(false);
    setInitialInputsLocked(true);
    setIsParticipantsOpen(false);
    syncParticipantThemes(safeInitialInputs);
    setTimeout(() => {
      itemNameRef.current?.focus();
    }, 0);
  };

  const editParticipant = (index) => {
    setInitialInputsLocked(false);
    setIsParticipantsOpen(true);
    setNewParticipant(false);
    onAddParticipantModeChange?.(true);
    setTimeout(() => {
      inputRef.current[index]?.focus();
    }, 0);
  };

  const cancelNewParticipant = () => {
    setInitialInputs((previousInputs) => previousInputs.slice(0, -1));
    setParticipants((previousParticipants) => previousParticipants.slice(0, -1));
    setNewParticipant(false);
    setInitialInputsLocked(true);
    onAddParticipantModeChange?.(false);
  };

  return (
    <div className={`participants${initialInputsLocked ? ' participants-locked' : ''}${initialInputsLocked && !participantsVisible ? ' participants-collapsed' : ''}`}>
      {showMenuToggle && initialInputsLocked && (
        <button
          className="participants-toggle"
          type="button"
          title={isParticipantsOpen ? 'Hide participants' : 'Show participants'}
          aria-label={isParticipantsOpen ? 'Hide participants' : 'Show participants'}
          aria-expanded={isParticipantsOpen}
          onClick={() => setIsParticipantsOpen((open) => !open)}
        >
          <FaUsers aria-hidden="true" />
          <span className="participants-count">{safeInitialInputs.length}</span>
        </button>
      )}
      {participantsVisible && (
        <>
          {newParticipant && (
            <button type="button" className="close-add-participant" title="Cancel adding participant" aria-label="Cancel adding participant" onClick={cancelNewParticipant}>
              <FaTimes aria-hidden="true" />
            </button>
          )}
          {!initialInputsLocked && (
            <div ref={unlockedSectionRef} className="participants-unlocked participants-unlocked-centered">
              <h3>Participants</h3>
              <div className="split-between">
                <label>Split Between:</label>
                <input
                  type="text"
                  value={splitBetween}
                  placeholder="Enter number of people"
                  onChange={(e) => setSplitBetween(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      generateInputs();
                      setTimeout(() => {
                        inputRef.current[0]?.focus();
                      }, 0);
                    }
                  }}
                />
              </div>
            </div>
          )}
          <div className="participants-inputs">
            {!initialInputsLocked && safeInitialInputs.map((value, index) => (
              <div key={index} className="participant-input">
                <label>Person {index + 1}</label>
                <input
                  ref={(el) => {
                    inputRef.current[index] = el;
                  }}
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const newInputs = [...safeInitialInputs];
                    newInputs[index] = e.target.value;
                    setInitialInputs(newInputs);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (index < safeInitialInputs.length - 1) {
                        inputRef.current[index + 1]?.focus();
                      } else {
                        lockParticipants();
                      }
                    }
                  }}
                />
              </div>
            ))}
          </div>
          {safeInitialInputs.length > 0 && safeInitialInputs.every((name) => String(name).trim() !== '') && !initialInputsLocked && (
            <button className="lock-button" onClick={lockParticipants}>Lock Participants</button>
          )}
          <div className="participants-list">
            {initialInputsLocked && (
              <div className="locked-inputs">
                {safeInitialInputs.map((value, index) => (
                  <div key={index} className="locked-participant">
                    <button
                      className="lock-button"
                      style={{
                        '--primary': themes[index % themes.length].primary,
                        '--background': themes[index % themes.length].background,
                        '--border': themes[index % themes.length].border,
                        '--shadow': themes[index % themes.length].shadow,
                      }}
                    >
                      {value}
                    </button>
                    <div className="participant-actions">
                      <button type="button" className="participant-action" title={`Edit ${value}`} aria-label={`Edit ${value}`} onClick={() => editParticipant(index)}>
                        <FaEdit aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
