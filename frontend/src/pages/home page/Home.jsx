// import {useState, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import './Home.css';

const Home = () => {
    const navigate = useNavigate();
    return (
        <div className="home-container">
            <div className="home-content">
                <p className="head">Welcome to the Kitchen Split!</p>
                <p className="tagline">Cooking Up fair splits</p>
            </div>
            <div className="button-container">
                <button className="split-button" onClick={() => navigate('/manual-split')}>Manual Split</button>
                {/* <button className="split-button" onClick={() => navigate('/excel-split')}>Excel Split</button> */}
            </div>
        </div>
    );
};
export default Home;