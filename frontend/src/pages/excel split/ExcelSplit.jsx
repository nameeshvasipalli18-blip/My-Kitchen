import {useState, useRef} from 'react';
import * as XLSX from 'xlsx';
import {Participants} from '../../components/participants/Participants.jsx';
// import {ItemInputs} from '../../components/item inputs/ItemInputs.jsx';
import { ItemCards } from '../../components/item cards/ItemCards.jsx';
import {themes} from '../../components/themes/themes.jsx';
import "./ExcelSplit.css"

const ExcelSplit = () => {
  const [file, setFile] = useState(null);
  const [displayImport, setDisplayImport] = useState(false);
  const [splitBetween, setSplitBetween] = useState("");
  const [initialInputs, setInitialInputs] = useState([]);
  const [initialInputsLocked, setInitialInputsLocked] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [lockButtonTheme, setLockButtonTheme] = useState([]);
  const inputRef = useRef([]);
  const itemNameRef = useRef([]);
  const emptyItem = {
    name: "",
    price: "",
    paidBy: "",
    splitType: "",
    splitBetween: []
  };
  const [currentItem, setCurrentItem] = useState(emptyItem);
  const [savedItems, setSavedItems] = useState([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);

  const camelCase = (str) => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
  }
  const handleFile = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
  };
  const readExcelFile = async (file) => {
    if (!file) return;
    const data =  await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0]; 
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    setDisplayImport(true);
    console.log('Rows:', rows);
    const updatedItems = normalizeData(rows);
    const newItems = updatedItems.map((item) => ({
      name: item.name,
      price: item.price,
      paidBy: item.paidBy,
      splitType: item.splitType,
      splitBetween: item.splitBetween
    }));
    setSavedItems(newItems);    
  };

  const mapToParticipantName = (name, participantMap) => {
    const normalizedName = String(name ?? "").trim();
    if (!normalizedName) return "";
    return participantMap.get(normalizedName.toUpperCase()) ?? normalizedName;
  };

  const parseSplitBetween = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    return value.split(",");
  };

  const normalizeData = (rows) => {
    const participantMap = new Map(
      participants.map((participant) => [participant.name.trim().toUpperCase(), participant.name.trim()])
    );

    const normalized = rows.map((row) => {
      const normalizedRow = {};
      for (const key in row) {
        const normalizedKey = camelCase(key);
        normalizedRow[normalizedKey] = row[key];
        normalizedRow["splitType"] = "";
      }
      normalizedRow.paidBy = mapToParticipantName(normalizedRow.paidBy, participantMap);
      normalizedRow.splitBetween = parseSplitBetween(normalizedRow.splitBetween)
        .map((name) => mapToParticipantName(name, participantMap))
        .filter(Boolean);
      return normalizedRow;
    });
    const updatedData = addSplitType(normalized);
    console.log('Normalized Data:', normalized);
    return updatedData;
  };     
  const addSplitType = (data) => {
    const updatedData = data.map((item) => {
      let splitType;
      if (item.splitBetween.length === participants.length) {
        splitType = "all";
      } else if (
        item.splitBetween.length === 1 &&
        item.paidBy === item.splitBetween[0]
      ) {
        splitType = item.paidBy;
      } else {
        splitType = "custom";
      }
    return {
      ...item,
      splitType: splitType,
      price: Number(Number(item.price).toFixed(2)),
    };
  });
  console.log('Updated Data:', updatedData);
  return updatedData;
};


      
  return (
    <div className = "excel-split-container">
      <p className = "header">Excel Split</p>
      <div className = "split-container">
        {!initialInputsLocked && <Participants
        splitBetween={splitBetween}
        setSplitBetween={setSplitBetween}
        initialInputs={initialInputs}
        setInitialInputs={setInitialInputs}
        initialInputsLocked={initialInputsLocked}
        setInitialInputsLocked={setInitialInputsLocked}
        participants={participants}
        setParticipants={setParticipants}
        lockButtonTheme={lockButtonTheme}
        setLockButtonTheme={setLockButtonTheme}
        inputRef={inputRef}
        itemNameRef={itemNameRef}
        />}
        </div>
        {initialInputsLocked && (
        <div className = "excel-input-container">   
        <input
          className = "excel-input"
          type = "file"
          accept = ".xlsx, .xls"
          onChange = {handleFile}
        />
        <button
        className = "excel-import-button" 
        onClick = {() => readExcelFile(file)}>
          Import 
        </button>
      </div>
      )}
        {initialInputs.length > 0 && !initialInputsLocked && (
          <button className="lock-button" onClick = {() => {
            setInitialInputsLocked(true)
              const participants = initialInputs.map((name, index) => ({
                name,
                theme: themes[index % themes.length],
              }));
                setParticipants(participants);
                setTimeout(() => {
                  itemNameRef.current[0]?.focus()
               }, 0);
              }}>Lock Participants</button>
            )}
          {initialInputsLocked && (
          <div className = "locked-inputs">
            {initialInputs.map((value, index) => (
              <div key={index}>
              <button 
               className="lock-button" 
               style={{
                  "--primary": themes[index % themes.length].primary,
                  "--background": themes[index % themes.length].background,
                  "--border": themes[index % themes.length].border,
                  "--shadow": themes[index % themes.length].shadow,
                }}
                onClick = {() => {setInitialInputsLocked(false)}}>{value}</button>
               </div>
              ))}
              <div>
                <button className="lock-button" onClick = {() => {
                  setInitialInputsLocked(false);
                  const newParticipants = [...initialInputs, ""]; 
                  setInitialInputs(newParticipants);
                  setTimeout(() => {
                  inputRef.current[newParticipants.length - 1]?.focus();
                }, 0);
              }}>+</button>
            </div>
          </div>
        )}
        {initialInputsLocked && displayImport &&(
        <ItemInputs
          initialInputs={initialInputs}
          emptyItem={emptyItem}
          currentItem={currentItem}
          setCurrentItem={setCurrentItem}
          savedItems={savedItems}
          setSavedItems={setSavedItems}
          selectedItemIndex={selectedItemIndex}
          setSelectedItemIndex={setSelectedItemIndex}
          itemNameRef={itemNameRef}
          participants={participants}
        />
      )}
      {savedItems.length > 0 && 
          <ItemCards
            savedItems={savedItems}
            selectedItemIndex={selectedItemIndex}
            setSelectedItemIndex={setSelectedItemIndex}
            setCurrentItem={setCurrentItem}
            itemNameRef={itemNameRef}
            setSavedItems={setSavedItems}
            participants={participants}
          />}
    </div>

  );
};
export default ExcelSplit;