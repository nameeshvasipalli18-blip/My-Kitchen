import {useState, useRef} from "react";

export const ItemManager = ({initialInputs, saveDefaults, defaultPayer, defaultSplitType, tripParticipants, itemNameRef, handleItem}) => {
    const newItem = {
        name: "",
        price: "",
        paidBy: defaultPayer || "",
        splitType: defaultSplitType || "",
        splitBetween: tripParticipants || [],
    };
    const itemPriceRef = useRef(null);
    const itemPaidByRef = useRef(null);
    const itemSplitTypeRef = useRef(null);
    const itemSplitBetweenRef = useRef(null);
    const [overrideDefaultOptions, setOverrideDefaultOptions] = useState(false);
    const [selectedItemIndex, setSelectedItemIndex] = useState(null);
    const [currentItem, setCurrentItem] = useState(newItem);

    const validateItem = (item) => {
      const name = item?.name?.trim();
      const paidBy = item?.paidBy?.trim();
      const splitType = item?.splitType?.trim();
      const price = Number(item?.price);

      if (!name) return 'Item name is required.';
      if (!Number.isFinite(price) || price <= 0) return 'Price must be a number greater than 0.';
      if (!paidBy) return 'Please select who paid.';
      if (!splitType) return 'Please select a split type.';
      if (splitType === 'custom' && (!Array.isArray(item?.splitBetween) || item.splitBetween.length === 0)) {
        return 'Choose at least one participant for custom split.';
      }
      return null;
    };
    const persistCurrentItem = () => {
      const validationError = validateItem(currentItem);
      if (validationError) {
        // setSettlementResults(validationError);
        return;
      }
    }


    return (
        <div className="item-manager">
            {saveDefaults && (
            <div className="item-inputs">
                <input
                ref={itemNameRef}
                type="text"
                className="item-name-input"
                placeholder="Item Name"
                value={currentItem.name}
                onChange={(e) => {
                setCurrentItem((prev) => ({...prev, name: e.target.value}));
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        itemPriceRef.current?.focus();
                    } else if (e.key === "Escape" && selectedItemIndex !== null) {
                        setSelectedItemIndex(null);
                        setCurrentItem(currentItem);
                        itemNameRef.current?.focus();
                    } else if (e.key === "Escape" && selectedItemIndex === null) {
                        setCurrentItem(newItem);
                        itemNameRef.current?.focus();
                    }
                }}
                />
                <input
                ref={itemPriceRef}
                type="text"
                className="item-price-input"
                placeholder="Item Price"
                value={currentItem.price}
                onChange={(e) => {
                    setCurrentItem((prev) => ({...prev, price: e.target.value}));
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        itemPaidByRef.current?.focus();
                    } else if (e.key === "Enter") {
                        persistCurrentItem();
                        itemNameRef.current?.focus();
                    } else if (e.key === "Escape" && selectedItemIndex !== null) {
                        setSelectedItemIndex(null);
                        setCurrentItem(newItem);
                        itemNameRef.current?.focus();
                    } else if (e.key === "Escape" && selectedItemIndex === null) {
                        setCurrentItem(newItem);
                        itemNameRef.current?.focus();
                    }
                }}
                />
                {overrideDefaultOptions && (
                <div className="default-options">
                    <select
                    ref={itemPaidByRef}
                    className="item-paid-by-select"
                    value={currentItem.paidBy}
                    onChange={(e) => {
                        setCurrentItem((prev) => ({...prev, paidBy: e.target.value}));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowRight") {
                            itemSplitTypeRef.current?.focus();
                        } else if (e.ctrlKey && e.key === "Enter") {
                            persistCurrentItem();
                            itemNameRef.current?.focus();
                        } else if (e.key === "Escape" && selectedItemIndex !== null) {
                            setSelectedItemIndex(null);
                            setCurrentItem(newItem);
                            itemNameRef.current?.focus();
                        } else if (e.key === "Escape" && selectedItemIndex === null) {
                            setCurrentItem(newItem);
                            itemNameRef.current?.focus();
                        }
                    }}
                    >
                    <option value="">Select Payer</option>
                    {initialInputs.map((person, idx) => (
                    <option key={idx} value={person}>{person}</option>
                    ))}
                    </select>
                    <select
                    ref={itemSplitTypeRef}
                    className="item-split-type-select"
                    value={currentItem.splitType}
                    onChange={(e) => {
                        setCurrentItem((prev) => ({...prev, splitType: e.target.value}));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && currentItem.splitType === "custom") {
                            itemSplitBetweenRef.current?.focus();
                        } else if (e.ctrlKey && e.key === "Enter") {
                            persistCurrentItem();
                            itemNameRef.current?.focus();
                        } else if (e.key === "Escape" && selectedItemIndex !== null) {
                            setSelectedItemIndex(null);
                            setCurrentItem(newItem);
                            itemNameRef.current?.focus();
                        } else if (e.key === "Escape" && selectedItemIndex === null) {
                            setCurrentItem(newItem);
                            itemNameRef.current?.focus();
                        }
                    }}
                    >
                        <option value="">Select Split Type</option>
                        <option value="all">All</option>
                        <option value={currentItem.paidBy}>Self</option>
                        <option value="custom">Custom</option>
                    </select>
                    {currentItem.splitType === "custom" && (
                        <select
                        multiple
                        className="item-split-between-select"
                        ref={itemSplitBetweenRef}
                        value={currentItem.splitBetween}
                        onChange={(e) => {
                            const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
                            setCurrentItem((prev) => ({...prev, splitBetween: selectedOptions}));
                        }}
                        onKeyDown={(e) => {
                            if (e.ctrlKey && e.key === "Enter") {
                                persistCurrentItem();
                                itemNameRef.current?.focus();
                            } else if (e.key === "Escape" && selectedItemIndex !== null) {
                                setSelectedItemIndex(null);
                                setCurrentItem(newItem);
                                itemNameRef.current?.focus();
                            } else if (e.key === "Escape" && selectedItemIndex === null) {
                                setCurrentItem(newItem);
                                itemNameRef.current?.focus();
                            }
                        }}
                        >
                        {initialInputs.map((person, idx) => (
                        <option key={idx} value={person}>{person}</option>
                        ))}
                        </select>
                    )}
                </div>
                )}
                <button
                className="lock-button"
                onClick={() => {
                    handleItem(currentItem);
                    setSelectedItemIndex(null);
                    setCurrentItem(newItem);
                    setOverrideDefaultOptions(false);
                    itemNameRef.current?.focus();
                }}
                >
                    {selectedItemIndex !== null ? "Update Item" : "Add Item"}
                </button>
                {/* {savedItems.length > 0 && (
                <button
                className="lock-button"
                onClick={() => {
                  submitItems();
                }}
                >
                Submit
                </button>
                )} */}
                <button 
                className='lock-button'
                onClick={() => setOverrideDefaultOptions((prev) => !prev)}>Override defaults</button>
            </div>
          )} 
        </div>    
    )
};