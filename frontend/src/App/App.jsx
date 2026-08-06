import {Routes, Route} from 'react-router-dom'
import ManualSplit from '../pages/manual split/ManualSplit.jsx';
import Home from '../pages/home page/Home.jsx';
import ExcelSplit from '../pages/excel split/ExcelSplit.jsx';

const App = () => {
    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/manual-split" element={<ManualSplit />} />
                <Route path="/excel-split" element={<ExcelSplit />} />
            </Routes>
        </div>
    );
};
export default App;