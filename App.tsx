
import React, { useState } from 'react';
import Navbar from './components/Navbar';
import InfoHub from './components/InfoHub';
import Customizer from './components/Customizer';

type Page = 'info-hub' | 'customizer';

const App: React.FC = () => {
    const [activePage, setActivePage] = useState<Page>('info-hub');

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            <Navbar activePage={activePage} setActivePage={setActivePage} />
            {activePage === 'info-hub' && <InfoHub />}
            {activePage === 'customizer' && <Customizer />}
        </div>
    );
};

export default App;
