import React, {useEffect, useRef} from 'react';
import './App.css';
import {startIframeBridge} from "@/entrypoints/sidepanel/iframe-bridge.ts";

export default () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) {
            return;
        }

        return startIframeBridge(iframe);
    }, []);

    return (
        <iframe
            ref={iframeRef}
            title="MySquad"
            src="http://localhost:3000"
        />
    );
};
