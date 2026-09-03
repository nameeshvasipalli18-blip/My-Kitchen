import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { FaBars, FaCalendarDays, FaEllipsis, FaFloppyDisk, FaPen, FaPlus, FaReceipt, FaStore, FaTrash, FaXmark } from 'react-icons/fa6';
import api from '../../api.js';
import './ItemInputs.css';

const createItem = (trip) => ({
  name: '',
  price: '',
  paidBy: trip.defaultPayer || trip.participants[0] || '',
  splitType: 'all',
  splitBetween: [...trip.participants],
});

export const EnterBillsWorkspace = ({ kitchenId, initialInputs, shoppingTrip, setShoppingTrip, setShoppingTrips, onTripSaved, editingTripId, setEditingTripId, mobileKeyboardOpen }) => {
  const itemNameInputRef = useRef(null);
  const inlineItemNameInputRef = useRef(null);
  const shouldFocusInlineItemNameRef = useRef(false);
  const addItemButtonRef = useRef(null);
  const activeBillCardRef = useRef(null);
  const activeBillBodyRef = useRef(null);
  const newActiveBillItemRef = useRef(null);
  const itemEntryCardRef = useRef(null);
  const sessionBillsRef = useRef(null);
  const launchCompletedRef = useRef(false);
  const cancelInlineEditTimerRef = useRef(null);
  const entryCardControls = useAnimation();
  const [item, setItem] = useState(() => createItem(shoppingTrip));
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionBillsOpen, setSessionBillsOpen] = useState(false);
  const [savedBills, setSavedBills] = useState([]);
  const [inlineEditingIndex, setInlineEditingIndex] = useState(null);
  const [inlineItem, setInlineItem] = useState(null);
  const [inlineOptionsOpen, setInlineOptionsOpen] = useState(false);
  const [isCancellingInlineEdit, setIsCancellingInlineEdit] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [launchingItem, setLaunchingItem] = useState(null);
  const [isBillGlowing, setIsBillGlowing] = useState(false);
  const [isSavedBillsUpdating, setIsSavedBillsUpdating] = useState(false);
  const [newItemIndex, setNewItemIndex] = useState(null);
  const [isBillScrollActive, setIsBillScrollActive] = useState(false);
  const [isItemNameFocused, setIsItemNameFocused] = useState(false);
  const [isItemPriceFocused, setIsItemPriceFocused] = useState(false);
  const isDraftingItem = shoppingTrip.items.length === 0 && Boolean(item.name.trim() || item.price.trim());
  const activeBillTotal = shoppingTrip.items.reduce((total, activeItem) => total + (Number(activeItem.price) || 0), 0);

  useEffect(() => {
    let active = true;
    api.get(`/kitchens/${kitchenId}/bills?mine=true`).then((response) => {
      if (active) setSavedBills(response.data?.trips || []);
    }).catch(() => {
      if (active) setSavedBills([]);
    });
    return () => { active = false; };
  }, [kitchenId]);

  useEffect(() => () => window.clearTimeout(cancelInlineEditTimerRef.current), []);

  useEffect(() => {
    const activeBillCard = activeBillCardRef.current;
    const itemEntryCard = itemEntryCardRef.current;
    if (!activeBillCard || !itemEntryCard) return undefined;

    const updateActiveBillMaxHeight = () => {
      const billTop = activeBillCard.getBoundingClientRect().top;
      const entryCardTop = itemEntryCard.getBoundingClientRect().top;
      const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
      const clearance = Number.isFinite(rootFontSize) ? rootFontSize * 2 : 32;
      if (shoppingTrip.items.length > 0) {
        activeBillCard.style.setProperty('--active-bill-max-height', `${Math.max(0, entryCardTop - billTop - clearance)}px`);
      } else {
        activeBillCard.style.removeProperty('--active-bill-max-height');
      }
      const visibleViewportHeight = window.visualViewport?.height || window.innerHeight;
      activeBillCard.style.setProperty('--item-entry-bottom-offset', `${Math.max(0, visibleViewportHeight - entryCardTop)}px`);
    };

    updateActiveBillMaxHeight();
    const layoutTimer = window.setTimeout(updateActiveBillMaxHeight, 320);
    const resizeObserver = new ResizeObserver(updateActiveBillMaxHeight);
    resizeObserver.observe(itemEntryCard);
    window.addEventListener('resize', updateActiveBillMaxHeight);
    return () => {
      window.clearTimeout(layoutTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateActiveBillMaxHeight);
    };
  }, [isDraftingItem, mobileKeyboardOpen, optionsOpen, shoppingTrip.items.length]);

  useEffect(() => {
    if (newItemIndex === null) return undefined;
    requestAnimationFrame(() => {
      const itemList = activeBillBodyRef.current;
      const newItem = newActiveBillItemRef.current;
      if (itemList && newItem) {
        const listBounds = itemList.getBoundingClientRect();
        const itemBounds = newItem.getBoundingClientRect();
        const itemTopOffset = itemBounds.top - listBounds.top;
        const itemBottomOffset = itemBounds.bottom - listBounds.bottom;
        if (itemTopOffset < 0 || itemBottomOffset > 0) {
          itemList.scrollTo({
            top: itemList.scrollTop + (itemTopOffset < 0 ? itemTopOffset : itemBottomOffset),
            behavior: 'smooth',
          });
        }
      }
      itemNameInputRef.current?.focus({ preventScroll: true });
    });
    const clearScrollCue = window.setTimeout(() => setIsBillScrollActive(false), 700);
    return () => window.clearTimeout(clearScrollCue);
  }, [newItemIndex]);

  useEffect(() => {
    if (!sessionBillsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!sessionBillsRef.current?.contains(event.target)) {
        setSessionBillsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [sessionBillsOpen]);

  const addItem = () => {
    if (launchingItem) return;
    const price = Number(item.price);
    if (!item.name.trim() || !Number.isFinite(price) || price <= 0) {
      setError('Enter an item name and a price greater than zero.');
      return;
    }
    const splitBetween = item.splitType === 'custom' ? item.splitBetween : [...shoppingTrip.participants];
    if (splitBetween.length === 0) {
      setError('Choose at least one member for this split.');
      return;
    }
    const nextItem = { ...item, name: item.name.trim(), price, splitBetween };
    const buttonBounds = addItemButtonRef.current?.getBoundingClientRect();
    const billBounds = activeBillBodyRef.current?.getBoundingClientRect();
    if (!buttonBounds || !billBounds) return;

    launchCompletedRef.current = false;
    setLaunchingItem({
      nextItem,
      origin: { x: buttonBounds.left + (buttonBounds.width / 2), y: buttonBounds.top },
      destination: { x: billBounds.left + (billBounds.width / 2), y: billBounds.top + Math.min(42, billBounds.height / 2) },
    });
    setOptionsOpen(false);
    setError('');
  };

  const completeItemLaunch = () => {
    if (!launchingItem || launchCompletedRef.current) return;
    launchCompletedRef.current = true;
    setNewItemIndex(shoppingTrip.items.length);
    setIsBillScrollActive(true);
    setShoppingTrip((trip) => ({ ...trip, items: [...trip.items, launchingItem.nextItem] }));
    setItem(createItem(shoppingTrip));
    setLaunchingItem(null);
    triggerBillGlow();
  };

  const triggerBillGlow = () => {
    setIsBillGlowing(false);
    requestAnimationFrame(() => setIsBillGlowing(true));
  };

  const triggerSavedBillsUpdate = () => {
    setMenuOpen(true);
    setSessionBillsOpen(false);
    setIsSavedBillsUpdating(false);
    requestAnimationFrame(() => setIsSavedBillsUpdating(true));
    window.setTimeout(() => {
      setIsSavedBillsUpdating(false);
      setMenuOpen(false);
    }, 900);
  };

  const wobbleEntryCard = () => {
    entryCardControls.start({
      x: [0, -3, 3, -2, 0],
      rotate: [0, -0.7, 0.7, -0.35, 0],
      transition: { duration: 0.3, ease: 'easeInOut' },
    });
  };

  const focusItemNameInput = () => {
    itemNameInputRef.current?.focus();
  };

  const handleEntryArrowNavigation = (event) => {
    if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) return;
    const controls = [...event.currentTarget.querySelectorAll('[data-item-entry-control]')].filter((control) => !control.disabled);
    const currentIndex = controls.indexOf(event.target.closest('[data-item-entry-control]'));
    if (currentIndex === -1) return;
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextControl = controls[currentIndex + direction];
    if (!nextControl) return;
    event.preventDefault();
    wobbleEntryCard();
    nextControl.focus();
  };

  const handleInlineEditArrowNavigation = (event) => {
    if (!['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) return;
    const controls = [...event.currentTarget.querySelectorAll('[data-inline-edit-control]')].filter((control) => !control.disabled);
    const currentIndex = controls.indexOf(event.target.closest('[data-inline-edit-control]'));
    if (currentIndex === -1) return;
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextControl = controls[currentIndex + direction];
    if (!nextControl) return;
    event.preventDefault();
    nextControl.focus();
  };

  const editItem = (index, showOptions = false) => {
    const activeItem = shoppingTrip.items[index];
    setInlineItem({ ...activeItem, splitBetween: [...activeItem.splitBetween] });
    setInlineEditingIndex(index);
    setInlineOptionsOpen(showOptions);
    shouldFocusInlineItemNameRef.current = !showOptions;
  };

  const saveInlineItem = () => {
    const price = Number(inlineItem?.price);
    if (!inlineItem?.name?.trim() || !Number.isFinite(price) || price <= 0) {
      return;
    }
    const splitBetween = inlineItem.splitType === 'custom' ? inlineItem.splitBetween : [...shoppingTrip.participants];
    if (splitBetween.length === 0) {
      return;
    }
    setShoppingTrip((trip) => ({ ...trip, items: trip.items.map((activeItem, index) => index === inlineEditingIndex ? { ...inlineItem, name: inlineItem.name.trim(), price, splitBetween } : activeItem) }));
    triggerBillGlow();
    setInlineEditingIndex(null);
    setInlineItem(null);
    setInlineOptionsOpen(false);
  };

  const cancelInlineEdit = () => {
    if (isCancellingInlineEdit) return;
    setIsCancellingInlineEdit(true);
    setInlineEditingIndex(null);
    setInlineItem(null);
    setInlineOptionsOpen(false);
    shouldFocusInlineItemNameRef.current = false;
    window.clearTimeout(cancelInlineEditTimerRef.current);
    cancelInlineEditTimerRef.current = window.setTimeout(() => setIsCancellingInlineEdit(false), 280);
  };

  const deleteItem = (index) => {
    setShoppingTrip((trip) => ({ ...trip, items: trip.items.filter((_, itemIndex) => itemIndex !== index) }));
    triggerBillGlow();
    if (inlineEditingIndex === index) {
      cancelInlineEdit();
    }
  };

  const resolveBillId = (bill) => bill.dbTripId ?? bill.id;

  const editSavedBill = (bill) => {
    const billId = resolveBillId(bill);
    if (!Number.isInteger(billId)) return;
    setShoppingTrip({
      ...bill,
      participants: Array.isArray(bill.participants) ? [...bill.participants] : [],
      defaultSplit: {
        type: bill.defaultSplit?.type || 'all',
        between: Array.isArray(bill.defaultSplit?.between) ? [...bill.defaultSplit.between] : [],
      },
      items: Array.isArray(bill.items) ? bill.items.map((billItem) => ({ ...billItem, splitBetween: Array.isArray(billItem.splitBetween) ? [...billItem.splitBetween] : [] })) : [],
    });
    setEditingTripId(billId);
    setSessionBillsOpen(false);
  };

  const deleteSavedBill = async (bill) => {
    const billId = resolveBillId(bill);
    if (!Number.isInteger(billId)) return;
    try {
      await api.delete(`/kitchens/${kitchenId}/bills/${billId}`);
      setSavedBills((bills) => bills.filter((savedBill) => resolveBillId(savedBill) !== billId));
      setShoppingTrips((trips) => trips.filter((savedBill) => resolveBillId(savedBill) !== billId));
      if (editingTripId === billId) {
        setEditingTripId(null);
        setShoppingTrip((trip) => ({
          ...trip,
          id: Date.now(),
          date: new Date().toISOString().slice(0, 10),
          store: 'lidl',
          items: [],
        }));
        setInlineEditingIndex(null);
        setInlineItem(null);
        setInlineOptionsOpen(false);
        setOptionsOpen(false);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to delete this bill.');
    }
  };

  const saveBill = async () => {
    if (shoppingTrip.items.length === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = editingTripId
        ? await api.put(`/kitchens/${kitchenId}/bills/${editingTripId}`, shoppingTrip)
        : await api.post(`/kitchens/${kitchenId}/bills`, shoppingTrip);
      setShoppingTrips((trips) => editingTripId ? trips.map((trip) => trip.id === editingTripId ? response.data.trip : trip) : [response.data.trip, ...trips]);
      setSavedBills((bills) => editingTripId ? bills.map((bill) => bill.id === editingTripId ? response.data.trip : bill) : [response.data.trip, ...bills]);
      if (!editingTripId) triggerSavedBillsUpdate();
      onTripSaved?.(response.data.tripId);
      await new Promise((resolve) => window.setTimeout(resolve, 750));
      setShoppingTrip((trip) => ({ ...trip, id: Date.now(), date: new Date().toISOString().slice(0, 10), store: 'lidl', items: [] }));
      setEditingTripId(null);
      setInlineEditingIndex(null);
      setInlineItem(null);
      setInlineOptionsOpen(false);
      setOptionsOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to save this bill.');
    } finally {
      setSaving(false);
    }
  };

  const menuHost = document.getElementById('enter-bills-menu');

  return (
    <section className={`enter-bills-workspace${mobileKeyboardOpen ? ' enter-bills-workspace-keyboard-open' : ''}`} aria-label="Enter bills">
      <div className={`active-bill-workspace${shoppingTrip.items.length === 0 && !isDraftingItem ? ' active-bill-workspace-empty' : ''}`}>
      <motion.section ref={activeBillCardRef} layout className={`active-bill-card${shoppingTrip.items.length === 0 ? ' active-bill-card-empty' : ''}${isBillGlowing ? ' active-bill-card-receiving' : ''}${saving ? ' active-bill-card-clearing' : ''}`} transition={{ layout: { duration: 0.28, ease: 'easeOut' } }} onAnimationEnd={(event) => event.animationName === 'activeBillReceiveGlow' && setIsBillGlowing(false)}>
        <header className="active-bill-header">
          <label className="active-bill-header-card">
            <FaCalendarDays className="active-bill-header-icon" aria-hidden="true" />
            <span className="active-bill-header-name">Date</span>
            <input type="date" value={shoppingTrip.date} onChange={(event) => setShoppingTrip((trip) => ({ ...trip, date: event.target.value }))} />
          </label>
          <label className="active-bill-header-card">
            <FaStore className="active-bill-header-icon" aria-hidden="true" />
            <span className="active-bill-header-name">Store</span>
            <input value={shoppingTrip.store} onChange={(event) => setShoppingTrip((trip) => ({ ...trip, store: event.target.value }))} />
          </label>
        </header>
        <div className={`active-bill-body${isCancellingInlineEdit ? ' active-bill-body-transitioning' : ''}${isBillScrollActive ? ' active-bill-body-scroll-active' : ''}`} ref={activeBillBodyRef} aria-busy={isCancellingInlineEdit} onChangeCapture={(event) => event.target.closest('.active-bill-item') && triggerBillGlow()}>
          {shoppingTrip.items.length === 0 ? <AnimatePresence initial={false}>{!isDraftingItem && !isItemNameFocused && !isItemPriceFocused && <motion.button className="active-bill-empty" type="button" onClick={focusItemNameInput} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>Add an item</motion.button>}</AnimatePresence> : shoppingTrip.items.map((activeItem, index) => (
            <motion.article ref={newItemIndex === index ? newActiveBillItemRef : null} layout="size" className={`active-bill-item${inlineEditingIndex === index ? ' active-bill-item-editing' : ''}`} key={`${activeItem.name}-${index}`} initial={newItemIndex === index ? { opacity: 0, scale: 0.72, y: -10 } : false} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ layout: { duration: 0.28, ease: 'easeOut' }, default: { type: 'spring', stiffness: 420, damping: 22 } }}>
              {inlineEditingIndex === index ? <div className="active-bill-item-edit-form" onKeyDown={handleInlineEditArrowNavigation}>
                <input ref={(node) => { inlineItemNameInputRef.current = node; if (node && shouldFocusInlineItemNameRef.current) { node.focus(); shouldFocusInlineItemNameRef.current = false; } }} data-inline-edit-control aria-label="Item name" value={inlineItem.name} onChange={(event) => setInlineItem((currentItem) => ({ ...currentItem, name: event.target.value }))} />
                <input data-inline-edit-control aria-label="Item price" inputMode="decimal" value={inlineItem.price} onChange={(event) => setInlineItem((currentItem) => ({ ...currentItem, price: event.target.value }))} />
                <AnimatePresence>
                {inlineOptionsOpen && <motion.div className="active-bill-inline-options" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                  <label>Paid by<select data-inline-edit-control value={inlineItem.paidBy} onChange={(event) => setInlineItem((currentItem) => ({ ...currentItem, paidBy: event.target.value }))}>{initialInputs.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                  <fieldset><legend>Split with</legend>{initialInputs.map((name) => <label key={name}><input data-inline-edit-control type="checkbox" checked={inlineItem.splitBetween.includes(name)} onChange={(event) => setInlineItem((currentItem) => ({ ...currentItem, splitType: 'custom', splitBetween: event.target.checked ? [...currentItem.splitBetween, name] : currentItem.splitBetween.filter((member) => member !== name) }))} />{name}</label>)}</fieldset>
                </motion.div>}
                </AnimatePresence>
                <div className="active-bill-inline-actions"><button data-inline-edit-control type="button" title="Custom split options" onClick={() => setInlineOptionsOpen((open) => !open)}><FaEllipsis aria-hidden="true" /></button><button data-inline-edit-control type="button" onClick={saveInlineItem}>Save</button><button data-inline-edit-control type="button" onClick={cancelInlineEdit}>Cancel</button></div>
              </div> : <><span>{activeItem.name}</span><strong>£{Number(activeItem.price).toFixed(2)}</strong>
              <div className="active-bill-item-actions">
                <button type="button" title={`Edit ${activeItem.name}`} onClick={() => editItem(index)}><FaPen aria-hidden="true" /></button>
                <button type="button" title={`Split options for ${activeItem.name}`} onClick={() => editItem(index, true)}><FaEllipsis aria-hidden="true" /></button>
                <button type="button" title={`Delete ${activeItem.name}`} onClick={() => deleteItem(index)}><FaTrash aria-hidden="true" /></button>
              </div></>}
            </motion.article>
          ))}
          <div className="active-bill-total">
            <span>Total bill</span>
            <strong>£{activeBillTotal.toFixed(2)}</strong>
          </div>
        </div>
        <footer className="active-bill-footer"><button type="button" disabled={shoppingTrip.items.length === 0 || saving} onClick={saveBill}><FaFloppyDisk aria-hidden="true" /><span>{saving ? 'Saving...' : 'Save bill'}</span></button></footer>
      </motion.section>
      <section ref={itemEntryCardRef} className="item-entry-card" tabIndex={0} onKeyDown={handleEntryArrowNavigation} onPointerDownCapture={(event) => event.target.closest('[data-item-entry-control]') && wobbleEntryCard()}>
        <motion.div className="item-entry-card-wobble" animate={entryCardControls}>
        <div className={`item-entry-row${optionsOpen ? ' item-entry-row-options-open' : ''}`}>
          <input ref={itemNameInputRef} data-item-entry-control aria-label="Item name" placeholder="Item name" value={item.name} onFocus={() => setIsItemNameFocused(true)} onBlur={() => setIsItemNameFocused(false)} onChange={(event) => setItem((currentItem) => ({ ...currentItem, name: event.target.value }))} />
          <input data-item-entry-control aria-label="Item price" placeholder="0.00" inputMode="decimal" value={item.price} onFocus={() => setIsItemPriceFocused(true)} onBlur={() => setIsItemPriceFocused(false)} onChange={(event) => setItem((currentItem) => ({ ...currentItem, price: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && addItem()} />
          <div className="item-entry-actions">
            <motion.button ref={addItemButtonRef} data-item-entry-control className="item-entry-add" type="button" title="Add item" disabled={Boolean(launchingItem)} onPointerDown={(event) => event.preventDefault()} onClick={addItem} animate={launchingItem ? { rotate: 360, scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }} transition={launchingItem ? { duration: 0.55, ease: 'easeInOut' } : { duration: 0 }}><FaPlus aria-hidden="true" /></motion.button>
            <button data-item-entry-control className="item-entry-options" type="button" title="Custom split options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><FaEllipsis aria-hidden="true" /></button>
          </div>
        </div>
        <AnimatePresence initial={false}>
        {optionsOpen && <motion.div className="item-entry-options-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
          <label>Paid by<select data-item-entry-control value={item.paidBy} onChange={(event) => setItem((currentItem) => ({ ...currentItem, paidBy: event.target.value }))}>{initialInputs.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <fieldset><legend>Split with</legend>{initialInputs.map((name) => <label key={name}><input data-item-entry-control type="checkbox" checked={item.splitBetween.includes(name)} onChange={(event) => setItem((currentItem) => ({ ...currentItem, splitType: 'custom', splitBetween: event.target.checked ? [...currentItem.splitBetween, name] : currentItem.splitBetween.filter((member) => member !== name) }))} />{name}</label>)}</fieldset>
        </motion.div>}
        </AnimatePresence>
        {error && <p className="item-entry-error">{error}</p>}
        </motion.div>
      </section>
      </div>
      {menuHost && createPortal(<div className="enter-bills-menu-content" ref={sessionBillsRef}>
        <button className="enter-bills-menu-toggle" type="button" title={menuOpen ? 'Close menu' : 'Open menu'} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => { setMenuOpen((open) => !open); setSessionBillsOpen(false); }}>
          <FaBars aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
        {menuOpen && <motion.div className="enter-bills-menu-options" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
        <div className={`session-bills${sessionBillsOpen ? ' session-bills-open' : ''}${isSavedBillsUpdating ? ' session-bills-updating' : ''}`}>
        <button className="session-bills-trigger" type="button" aria-label="Bills" aria-expanded={sessionBillsOpen} onClick={() => setSessionBillsOpen((open) => !open)}>
          <FaReceipt aria-hidden="true" />
          <span className="session-bills-tooltip" aria-hidden="true">Recent Bills</span>
          <span className="session-bills-count" aria-live="polite">{savedBills.length}</span>
        </button>
        {sessionBillsOpen && (
          <aside className="session-bills-popover" aria-label="Saved bills">
            <div className="session-bills-popover-header">
              <h2>Recent bills</h2>
              <button className="session-bills-close" type="button" title="Close recent bills" aria-label="Close recent bills" onClick={() => setSessionBillsOpen(false)}><FaXmark aria-hidden="true" /></button>
            </div>
            {savedBills.length === 0 ? <p>No recent bills yet.</p> : (
              <>
                <ul>
                  {savedBills.slice(0, 3).map((bill, index) => <li key={resolveBillId(bill) ?? index}><span>{bill.store}</span><strong>£{(bill.items || []).reduce((total, billItem) => total + (Number(billItem.price) || 0), 0).toFixed(2)}</strong><div className="session-bill-actions"><button type="button" title={`Edit ${bill.store} bill`} aria-label={`Edit ${bill.store} bill`} onClick={() => editSavedBill(bill)}><FaPen aria-hidden="true" /></button><button className="session-bill-delete" type="button" title={`Delete ${bill.store} bill`} aria-label={`Delete ${bill.store} bill`} onClick={() => deleteSavedBill(bill)}><FaTrash aria-hidden="true" /></button></div></li>)}
                </ul>
                {savedBills.length > 3 && (
                  <details className="session-bills-more">
                    <summary>{savedBills.length - 3} more bill{savedBills.length === 4 ? '' : 's'}</summary>
                    <ul>{savedBills.slice(3).map((bill, index) => <li key={resolveBillId(bill) ?? index + 3}><span>{bill.store}</span><strong>£{(bill.items || []).reduce((total, billItem) => total + (Number(billItem.price) || 0), 0).toFixed(2)}</strong><div className="session-bill-actions"><button type="button" title={`Edit ${bill.store} bill`} aria-label={`Edit ${bill.store} bill`} onClick={() => editSavedBill(bill)}><FaPen aria-hidden="true" /></button><button className="session-bill-delete" type="button" title={`Delete ${bill.store} bill`} aria-label={`Delete ${bill.store} bill`} onClick={() => deleteSavedBill(bill)}><FaTrash aria-hidden="true" /></button></div></li>)}</ul>
                  </details>
                )}
              </>
            )}
          </aside>
        )}
        </div>
        </motion.div>}
        </AnimatePresence>
      </div>, menuHost)}
      <AnimatePresence>
        {launchingItem && <motion.svg className="item-launch-arrow" viewBox="0 0 24 24" aria-hidden="true" initial={{ x: launchingItem.origin.x - 12, y: launchingItem.origin.y - 24, opacity: 1, scale: 0.75 }} animate={{ x: launchingItem.destination.x - 12, y: launchingItem.destination.y - 12, opacity: [1, 1, 0], scale: [0.75, 1.15, 0.6] }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: 'easeInOut' }} onAnimationComplete={completeItemLaunch}><path d="M12 3v14m0-14 5 5m-5-5-5 5M5 17h14v4H5z" /></motion.svg>}
      </AnimatePresence>
    </section>
  );
};