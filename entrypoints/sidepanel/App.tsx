import React, {useCallback, useEffect, useRef, useState} from 'react';
import './App.css';
import {startIframeBridge} from "@/entrypoints/sidepanel/iframe-bridge.ts";

export default () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) {
            return;
        }

        return startIframeBridge(iframe, {onReady: () => setIsLoading(false)});
    }, []);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
    }, []);

    return (
        <div className="app-shell" aria-busy={isLoading}>
            <iframe
                ref={iframeRef}
                title="MySquad"
                src="http://localhost:3000"
                allow="notifications"
                loading="eager"
                onLoad={handleLoad}
                className={isLoading ? "iframe-loading" : undefined}
            />
            {isLoading ? (
                <div className="iframe-loader" role="status" aria-live="polite">
                    <div className="iframe-spinner" />
                    <div className="iframe-loader-text">Loading MySquad...</div>
                </div>
            ) : null}
        </div>
    );
};
