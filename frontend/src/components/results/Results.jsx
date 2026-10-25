import { useState } from 'react';
import { FaDownload } from 'react-icons/fa6';

export const Results = ({ result }) => {
	const monthlyResults = Array.isArray(result?.monthlyResults) ? result.monthlyResults : [];
	const allResult = result?.allResult;
	const formatMonth = (month) => {
		const [year, monthNumber] = String(month).split('-').map(Number);
		return year && monthNumber
			? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
			: month;
	};
	const [selectedScope, setSelectedScope] = useState(() => {
		const today = new Date();
		return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
	});
	const today = new Date();
	const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
	const months = [...new Set([currentMonth, ...monthlyResults.map(({ month }) => month), ...(selectedScope === 'all' ? [] : [selectedScope])])].sort().reverse();
	const activeMonthlyResult = monthlyResults.find(({ month }) => month === selectedScope);
	const showingAllItems = selectedScope === 'all' && Boolean(allResult);
	const splitResult = showingAllItems ? allResult : activeMonthlyResult?.result || {
		participants: [], balances: {}, settlements: [], total: 0, tripCount: 0, itemCount: 0,
	};
	const resultLabel = showingAllItems ? 'All time' : formatMonth(selectedScope);
	const settlements = Array.isArray(splitResult?.settlements) ? splitResult.settlements : [];
	const hasNoItems = splitResult?.itemCount === 0;
	const downloadReceipt = () => {
		const participants = Array.isArray(splitResult?.participants) ? splitResult.participants : [];
		const balances = Object.entries(splitResult?.balances || {});
		const scale = 2;
		const width = 720;
		const padding = 48;
		const rowHeight = 48;
		const paymentRowCount = settlements.length || 1;
		const height = 428 + (balances.length + paymentRowCount) * rowHeight;
		const canvas = document.createElement('canvas');
		canvas.width = width * scale;
		canvas.height = height * scale;
		const context = canvas.getContext('2d');
		if (!context) {
			return;
		}

		context.scale(scale, scale);
		context.fillStyle = '#fbfff8';
		context.fillRect(0, 0, width, height);
		context.fillStyle = '#73bb37';
		context.fillRect(0, 0, width, 168);
		context.fillStyle = '#ffffff';
		context.font = '700 34px Figtree, sans-serif';
		context.fillText('KITCHEN SPLIT', padding, 68);
		context.font = '600 17px Figtree, sans-serif';
		context.fillText(`${resultLabel} settlement receipt`, padding, 100);
		context.font = '400 14px Figtree, sans-serif';
		context.fillText(`Generated ${new Date().toLocaleString('en-GB')}`, padding, 132);
		context.fillStyle = '#244615';
		context.font = '700 20px Figtree, sans-serif';
		context.fillText(`Total split: £${Number(splitResult?.total || 0).toFixed(2)}`, padding, 210);
		context.font = '400 15px Figtree, sans-serif';
		context.fillText(`Participants: ${participants.join(', ') || 'None'}`, padding, 240);

		const drawSection = (title, startY, rows) => {
			context.fillStyle = '#e6f2de';
			context.fillRect(padding, startY, width - padding * 2, 36);
			context.fillStyle = '#244615';
			context.font = '700 15px Figtree, sans-serif';
			context.fillText(title, padding + 14, startY + 24);
			rows.forEach((row, index) => {
				const rowY = startY + 36 + index * rowHeight;
				context.fillStyle = index % 2 === 0 ? '#ffffff' : '#f4f9f0';
				context.fillRect(padding, rowY, width - padding * 2, rowHeight);
				context.fillStyle = '#244615';
				context.font = '600 16px Figtree, sans-serif';
				context.fillText(row.label, padding + 14, rowY + 30);
				context.font = '700 16px Figtree, sans-serif';
				context.textAlign = 'right';
				context.fillText(row.value, width - padding - 14, rowY + 30);
				context.textAlign = 'left';
			});
		};

		const balanceRows = balances.map(([person, amount]) => ({
			label: person,
			value: `£${Number(amount).toFixed(2)}`,
		}));
		const paymentRows = settlements.length > 0
			? settlements.map((settlement) => ({
				label: `${settlement.from} pays ${settlement.to}`,
				value: `£${Number(settlement.amount).toFixed(2)}`,
			}))
			: [{ label: 'Everyone is already settled up', value: '£0.00' }];
		const balancesY = 276;
		const paymentsY = balancesY + 36 + balanceRows.length * rowHeight + 32;
		drawSection('BALANCES', balancesY, balanceRows);
		drawSection('PAYMENTS', paymentsY, paymentRows);

		const link = document.createElement('a');
		canvas.toBlob((image) => {
			if (!image) {
				return;
			}
			const receiptUrl = URL.createObjectURL(image);
			link.href = receiptUrl;
			link.download = `kitchen-split-receipt-${showingAllItems ? 'all-items' : selectedScope}.png`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(receiptUrl);
		}, 'image/png');
	};

	return (
		<section className="split-results" aria-live="polite">
			<div className="split-month-picker">
				<p className="split-month-title">Monthly split</p>
				<p className="split-month-hint">Choose a month to see who pays whom, based on each bill’s date.</p>
				<label className="split-month-field">
					<span>Month</span>
					<select value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}>
						{months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
						{allResult && <option value="all">All time</option>}
					</select>
				</label>
			</div>
			<header className="split-results-header">
				<div>
					<p>{resultLabel} split results</p>
					<strong>Total: £{Number(splitResult?.total || 0).toFixed(2)}</strong>
				</div>
				<button className="download-receipt-button" type="button" title="Download PNG receipt" onClick={downloadReceipt} disabled={hasNoItems}>
					<FaDownload aria-hidden="true" />
					<span>PNG receipt</span>
				</button>
			</header>
			{typeof splitResult?.tripCount === 'number' && (
				<p className="split-results-summary">
					{splitResult.tripCount} saved {splitResult.tripCount === 1 ? 'bill' : 'bills'} · {splitResult.itemCount} {splitResult.itemCount === 1 ? 'item' : 'items'}
				</p>
			)}
			{settlements.length > 0 ? (
				<ul className="split-settlements">
					{settlements.map((settlement, index) => (
						<li key={`${settlement.from}-${settlement.to}-${index}`}>
							<span>{settlement.from}</span>
							<span>pays</span>
							<span>{settlement.to}</span>
							<strong>£{Number(settlement.amount).toFixed(2)}</strong>
						</li>
					))}
				</ul>
			) : (
				<p className="split-results-empty">{hasNoItems ? (showingAllItems ? 'No saved bills to split yet.' : 'No saved bills for this month.') : 'Everyone is already settled up.'}</p>
			)}
		</section>
	);
};
