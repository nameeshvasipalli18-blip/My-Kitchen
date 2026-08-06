import { themes } from '../themes/themes';
import './Participants.css';
import api from '../../api.js';

export const Participants = ({splitBetween, setSplitBetween, initialInputs, setInitialInputs, setInitialInputsLocked, setParticipants, inputRef, itemNameRef}) => {
    const generateInputs = () => {
    const numPeople = Number(splitBetween);
    if (!Number.isInteger(numPeople) || numPeople <= 0) {
      setInitialInputs([]);
      return;
    }
    setInitialInputs((prev) => Array.from({length:numPeople}, (_,i) => prev[i] ?? ""))
    };
    const handleSubmit = async () => {
      try {
        const response = await api.post('/participantable', { participants: initialInputs });
        if (response.status === 200) {
          console.log('Participants submitted successfully:', response.data);
          setInitialInputs(response.data.participants.map(p => p.name));
        }
      } catch (error) {
        console.error('Error submitting participants:', error);
      }
    };


    return (
        <div className = "participants">
        <h3>Participants</h3>
        <div className="split-between">
          <label> 
            Split Between: 
          </label>
          <input
          type = "text"
        value = {splitBetween}
        placeholder = "Enter number of people"
        onChange = {(e) => {setSplitBetween(e.target.value)}}
        onKeyDown = {(e) => {if(e.key==='Enter'){
          generateInputs()
          inputRef.current[0]?.focus()
        }}}
        />
      </div>
      <div>
        {initialInputs.map((value,index) => (
          <div key ={index} className = "participant-input">
            <label>Person {index+1}</label>
            <input
              ref = {el => inputRef.current[index] = el}
              type = "text"
              value = {value}
              onChange = {(e)=> {
                const newInputs = [...initialInputs];
                newInputs[index]=e.target.value;
                setInitialInputs(newInputs);
            }}
              onKeyDown = {(e)=> {if(e.key==="Enter"){
                inputRef.current[index+1]?.focus()
                if(index === initialInputs.length - 1){
                  setInitialInputsLocked(true)
                  const participants = initialInputs.map((name, index) => ({
                    name,
                    theme: themes[index % themes.length],
                  }));
                  setParticipants(participants);
                  handleSubmit()
                }
                setTimeout(() => {
                  itemNameRef.current?.focus()
                }, 0);
              }}}
            />
          </div>
        ))}
        </div>
        </div>
    )
}  