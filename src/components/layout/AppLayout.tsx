
import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';

const AppLayout: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const location = useLocation();
    const isPlayerPage = location.pathname.startsWith('/play');

    return (
        <>
            {!isPlayerPage && <Header />}
            <main className={!isPlayerPage ? 'pt-16' : ''}>
                {children}
            </main>
        </>
    );
};

export default AppLayout;
