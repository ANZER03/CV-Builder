
import React from 'react';
import { LogoIcon } from './icons';

type Page = 'info-hub' | 'customizer';

interface NavbarProps {
    activePage: Page;
    setActivePage: (page: Page) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activePage, setActivePage }) => {
    const navBtnClasses = "py-4 px-3 rounded-md transition-colors duration-200";
    const activeClasses = "bg-blue-500 text-white shadow-sm";
    const inactiveClasses = "text-gray-600 hover:bg-gray-100";

    return (
        <nav className="bg-white shadow-md sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex justify-between items-center">
                    <div className="flex space-x-4">
                        <a href="#" className="flex items-center py-4 px-2 text-gray-700 hover:text-gray-900">
                            <LogoIcon />
                            <span className="font-bold">CV Customizer</span>
                        </a>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button 
                            onClick={() => setActivePage('info-hub')} 
                            className={`${navBtnClasses} ${activePage === 'info-hub' ? activeClasses : inactiveClasses}`}
                        >
                            Info Hub
                        </button>
                        <button 
                            onClick={() => setActivePage('customizer')}
                             className={`${navBtnClasses} ${activePage === 'customizer' ? activeClasses : inactiveClasses}`}
                        >
                            Customizer
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
