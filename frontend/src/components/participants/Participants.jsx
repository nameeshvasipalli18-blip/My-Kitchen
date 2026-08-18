import { themes } from '../themes/themes';
import api from '../../api.js';
import { useRef, useState } from 'react';
import { FaEdit, FaTimes, FaTrash } from 'react-icons/fa';
import './Participants.css';

export const Participants = ({
  splitBetween,
  setSplitBetween,
  initialInputs,
  setInitialInputs,
  initialInputsLocked,
  setInitialInputsLocked,
  setParticipants,
  inputRef,
  itemNameRef,
  onAddParticipantModeChange,
}) => {
  const [newParticipant, setNewParticipant] = useState(false);
  const [centerUnlockedSection, setCenterUnlockedSection] = useState(false);
  const unlockedSectionRef = useRef(null);

  const generateInputs = () => {
    const numPeople = Number(splitBetween);
    if (!Number.isInteger(numPeople) || numPeople <= 0) {
      setInitialInputs([]);
      return;
    }

    setInitialInputs((prev) => Array.from({ length: numPeople }, (_, i) => prev[i] ?? ""));
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post('/participantable', { participants: initialInputs });
      if (response.status === 200) {
        console.log('Participants submitted successfully:', response.data);
        setInitialInputs(response.data.participants);
      }
    } catch (error) {
      console.error('Error submitting participants:', error);
    }
  };

  const safeInitialInputs = Array.isArray(initialInputs) ? initialInputs : [];

  const newparticipantSubmit = async () => {
    const participantName = String(safeInitialInputs[safeInitialInputs.length - 1] ?? "").trim();
    if (!participantName) {
      return;
    }

    try {
      const response = await api.post('/newParticipant', { name: participantName });
      if (response.status === 200) {
        console.log('New participant submitted successfully:', response.data);
        setNewParticipant(false);
      }
    } catch (error) {
      console.error('Error submitting new participant:', error);
    }
  };

  const lockParticipants = () => {
    setCenterUnlockedSection(false);
    onAddParticipantModeChange?.(false);
    setInitialInputsLocked(true);
    const participants = safeInitialInputs.map((name, index) => ({
      name,
      theme: themes[index % themes.length],
    }));
    setParticipants(participants);
    handleSubmit();
    if (newParticipant) {
      newparticipantSubmit();
    }
    setTimeout(() => {
      itemNameRef.current?.focus();
    }, 0);
  };

  const editParticipant = (index) => {
    setInitialInputsLocked(false);
    setNewParticipant(false);
    setCenterUnlockedSection(true);
    onAddParticipantModeChange?.(true);
    setTimeout(() => {
      inputRef.current[index]?.focus();
    }, 0);
  };

  const cancelNewParticipant = () => {
    setInitialInputs((previousInputs) => previousInputs.slice(0, -1));
    setParticipants((previousParticipants) => previousParticipants.slice(0, -1));
    setNewParticipant(false);
    setCenterUnlockedSection(false);
    setInitialInputsLocked(true);
    onAddParticipantModeChange?.(false);
  };

  const deleteParticipant = async (participantPosition) => {
    try {
      const response = await api.delete(`/deleteParticipant/${participantPosition}`);
      if (response.status !== 200) {
        return;
      }

      const participantsResponse = await api.get('/participants');
      if (participantsResponse.status === 200) {
        const updatedParticipants = Array.isArray(participantsResponse.data?.participants)
          ? participantsResponse.data.participants
          : [];
        setInitialInputs(updatedParticipants);
        setParticipants(
          updatedParticipants.map((name, index) => ({
            name,
            theme: themes[index % themes.length],
          }))
        );
        setInitialInputsLocked(updatedParticipants.length > 0);
      }
    } catch (error) {
      console.error('Error deleting participant:', error);
    }
  };

  return (
    <div className={`participants${initialInputsLocked ? ' participants-locked' : ''}`}>
      {newParticipant && (
        <button
          type="button"
          className="close-add-participant"
          title="Cancel adding participant"
          aria-label="Cancel adding participant"
          onClick={cancelNewParticipant}
        >
          <FaTimes aria-hidden="true" />
        </button>
      )}
      {!initialInputsLocked && (
        <div
          ref={unlockedSectionRef}
          className={`participants-unlocked${centerUnlockedSection ? ' participants-unlocked-centered' : ''}`}
        >
        <h3>Participants</h3><div className="split-between">
          <label>Split Between:</label>
          <input
            type="text"
            value={splitBetween}
            placeholder="Enter number of people"
            onChange={(e) => {
              setSplitBetween(e.target.value);
            } }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                generateInputs();
                setTimeout(() => {
                  inputRef.current[0]?.focus();
                }, 0);
              }
            } } />
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

        {safeInitialInputs.length > 0 && safeInitialInputs.every((name) => String(name).trim() !== "") && !initialInputsLocked && (
          <button className="lock-button" onClick={lockParticipants}>
            Lock Participants
          </button>
        )}

        <div className="participants-list">
          {initialInputsLocked && (
            <div className="locked-inputs">
              {safeInitialInputs.map((value, index) => (
                <div key={index} className="locked-participant">
                  <button
                    className="lock-button"
                    style={{
                      "--primary": themes[index % themes.length].primary,
                      "--background": themes[index % themes.length].background,
                      "--border": themes[index % themes.length].border,
                      "--shadow": themes[index % themes.length].shadow,
                    }}
                  >
                    {value}
                  </button>
                  <div className="participant-actions">
                    <button
                      type="button"
                      className="participant-action"
                      title={`Edit ${value}`}
                      aria-label={`Edit ${value}`}
                      onClick={() => editParticipant(index)}
                    >
                      <FaEdit aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="participant-action participant-action-delete"
                      title={`Delete ${value}`}
                      aria-label={`Delete ${value}`}
                      onClick={() => deleteParticipant(index + 1)}
                    >
                      <FaTrash aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="locked-inputs-add">
                <button
                  className="lock-button"
                  onClick={() => {
                    onAddParticipantModeChange?.(true);
                    setInitialInputsLocked(false);
                    setNewParticipant(true);
                    setCenterUnlockedSection(true);
                    setInitialInputs((prev) => [...prev, ""]);
                    setParticipants((prev) => [
                      ...prev,
                      {
                        name: "",
                        theme: themes[prev.length % themes.length],
                      },
                    ]);
                    setTimeout(() => {
                      unlockedSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'center',
                      });
                      inputRef.current[safeInitialInputs.length]?.focus();
                    }, 0);
                  }}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};