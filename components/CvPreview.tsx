import React from 'react';

interface CvPreviewProps {
    htmlContent: string | null;
}

const CvPreview: React.FC<CvPreviewProps> = ({ htmlContent }) => {
    if (!htmlContent) {
        return (
            <div className="text-gray-500 text-center p-10 flex items-center justify-center" style={{ minHeight: '1056px' }}>
                <p>Preview will appear here once you load or upload your resume data and select a template.</p>
            </div>
        );
    }

    return (
        <iframe
            srcDoc={htmlContent}
            title="CV Preview"
            className="w-full border-0"
            style={{ minHeight: '1056px' }} // Approx height of a US Letter page
        />
    );
};

export default CvPreview;
