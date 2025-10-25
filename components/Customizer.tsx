
import React, { useState, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEY } from '../constants';
import { ResumeData, Resumes } from '../types';
import { readFileAsText, downloadFile } from '../utils/fileUtils';
import { templates } from '../templates';
import CvPreview from './CvPreview';
import { DownloadIcon, SparklesIcon, SpinnerIcon, GripVerticalIcon } from './icons';
import { GoogleGenAI, Type } from "@google/genai";

// Define a type for the customization configuration
type CustomizationConfig = {
    [K in keyof ResumeData]?: K extends 'personal' ? never : K extends 'summary' ? { included: boolean; text: string } : {
        included: boolean;
        items: {
            [id: string]: {
                included: boolean;
                bullets?: boolean[];
            };
        };
    };
};

type SectionKey = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certificates';

type FontSize = 'small' | 'medium' | 'large';
type ThemeColor = 'blue' | 'gray' | 'green' | 'purple';

const FONT_OPTIONS = ['Georgia', 'Times New Roman', 'Merriweather', 'Arial', 'Helvetica', 'Lato', 'Roboto'];
const COLOR_OPTIONS: { name: string, value: ThemeColor, hex: string }[] = [
    { name: 'Default Blue', value: 'blue', hex: '#2563EB' },
    { name: 'Classic Gray', value: 'gray', hex: '#4B5563' },
    { name: 'Modern Green', value: 'green', hex: '#059669' },
    { name: 'Elegant Purple', value: 'purple', hex: '#7C3AED' },
];

const SECTION_TITLES: Record<SectionKey, string> = {
    summary: 'Profil (Summary)',
    skills: 'Compétences (Skills)',
    experience: 'Expériences Professionnelles',
    projects: 'Projets Personnels',
    education: 'Formation',
    certificates: 'Certificats'
};

const Customizer: React.FC = () => {
    const [resumes] = useLocalStorage<Resumes>(STORAGE_KEY, {});
    const [fullResumeData, setFullResumeData] = useState<ResumeData | null>(null);
    const [config, setConfig] = useState<CustomizationConfig>({});
    const [jobOffer, setJobOffer] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
    const [selectedFont, setSelectedFont] = useState<string>(FONT_OPTIONS[0]);
    const [fontSize, setFontSize] = useState<FontSize>('medium');
    const [themeColor, setThemeColor] = useState<ThemeColor>('blue');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(['summary', 'skills', 'experience', 'projects', 'education', 'certificates']);
    const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
    const [dragOverSection, setDragOverSection] = useState<SectionKey | null>(null);


    const loadResumeData = (data: ResumeData) => {
        setFullResumeData(data);
        const newConfig: CustomizationConfig = {
            summary: { included: true, text: data.summary || '' },
            skills: { included: true, items: Object.fromEntries(data.skills.map((_, i) => [`skill-${i}`, { included: true }])) },
            experience: {
                included: true,
                items: Object.fromEntries(data.experience.map(exp => [exp.id, {
                    included: true,
                    bullets: (exp.description || '').split('\n').map(() => true)
                }]))
            },
            projects: {
                included: true,
                items: Object.fromEntries(data.projects.map(proj => [proj.id, {
                    included: true,
                    bullets: (proj.description || '').split('\n').map(() => true)
                }]))
            },
            education: { included: true, items: Object.fromEntries(data.education.map(edu => [edu.id, { included: true }])) },
            certificates: { included: true, items: Object.fromEntries(data.certificates.map(cert => [cert.id, { included: true }])) },
        };
        setConfig(newConfig);
        // Reset section order to default when loading new data
        setSectionOrder(['summary', 'skills', 'experience', 'projects', 'education', 'certificates']);
    };

    const handleLoadVersion = (name: string) => {
        if (name && resumes[name]) {
            loadResumeData(resumes[name]);
        }
    };
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await readFileAsText(file);
            const jsonData = JSON.parse(text) as ResumeData;
            loadResumeData(jsonData);
        } catch (error) {
            console.error("Error reading or parsing file:", error);
            alert("Failed to load JSON file. Please check the file format.");
        }
        event.target.value = '';
    };

    const handleConfigChange = (path: string[], value: any) => {
        setConfig(prev => {
            const newConfig = JSON.parse(JSON.stringify(prev));
            let current = newConfig;
            for (let i = 0; i < path.length - 1; i++) {
                current = current[path[i]];
            }
            current[path[path.length - 1]] = value;
            return newConfig;
        });
    };

    const handleAiOptimization = async () => {
        if (!fullResumeData || !jobOffer) {
            alert("Please load your resume data and paste a job description first.");
            return;
        }

        setIsOptimizing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const schema = {
                type: Type.OBJECT,
                properties: {
                    summary: {
                        type: Type.STRING,
                        description: "A professionally rewritten summary, tailored to the job description.",
                    },
                    skills: {
                        type: Type.ARRAY,
                        description: "An array of the most relevant skills selected from the original list.",
                        items: {
                            type: Type.STRING,
                        },
                    },
                },
                required: ["summary", "skills"],
            };

            const prompt = `You are an expert resume writer and career coach. Your task is to optimize a candidate's resume for a specific job opening.

            Here is the candidate's current resume data in JSON format:
            \`\`\`json
            ${JSON.stringify(fullResumeData, null, 2)}
            \`\`\`

            And here is the job description they are applying for:
            \`\`\`text
            ${jobOffer}
            \`\`\`

            Based on this information, please perform the following actions:
            1.  Rewrite the professional "summary" to be concise, impactful, and highly relevant to the key requirements of the job description.
            2.  From the candidate's original list of "skills", select only the ones that are most relevant to this specific job. The skills you return MUST be a subset of the original skills list. Do not invent new skills.

            Provide your response as a single JSON object that adheres to the specified schema.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                },
            });

            const aiResult = JSON.parse(response.text);

            setConfig(prev => {
                const newConfig = JSON.parse(JSON.stringify(prev));

                if (aiResult.summary && newConfig.summary) {
                    newConfig.summary.text = aiResult.summary;
                }

                if (aiResult.skills && Array.isArray(aiResult.skills) && newConfig.skills) {
                    const recommendedSkills = new Set(aiResult.skills);
                    fullResumeData.skills.forEach((skill, i) => {
                        const skillKey = `skill-${i}`;
                        if (newConfig.skills.items[skillKey]) {
                            newConfig.skills.items[skillKey].included = recommendedSkills.has(skill);
                        }
                    });
                }
                
                return newConfig;
            });

        } catch (error) {
            console.error("AI Optimization failed:", error);
            alert("Sorry, something went wrong while optimizing with AI. Please try again.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const filteredData = useMemo<ResumeData | null>(() => {
        if (!fullResumeData) return null;

        const data: ResumeData = JSON.parse(JSON.stringify(fullResumeData));

        if (config.summary?.included) data.summary = config.summary.text; else data.summary = '';
        if (!config.skills?.included) data.skills = [];
        else data.skills = fullResumeData.skills.filter((_, i) => config.skills?.items[`skill-${i}`]?.included);

        if (!config.experience?.included) data.experience = [];
        else {
            data.experience = fullResumeData.experience
                .filter(exp => config.experience?.items[exp.id]?.included)
                .map(exp => ({
                    ...exp,
                    description: (exp.description || '').split('\n')
                        .filter((_, i) => config.experience?.items[exp.id]?.bullets?.[i])
                        .join('\n')
                }));
        }

        if (!config.projects?.included) data.projects = [];
        else {
            data.projects = fullResumeData.projects
                .filter(proj => config.projects?.items[proj.id]?.included)
                .map(proj => ({
                    ...proj,
                    description: (proj.description || '').split('\n')
                        .filter((_, i) => config.projects?.items[proj.id]?.bullets?.[i])
                        .join('\n')
                }));
        }
        
        if (!config.education?.included) data.education = [];
        else data.education = fullResumeData.education.filter(edu => config.education?.items[edu.id]?.included);

        if (!config.certificates?.included) data.certificates = [];
        else data.certificates = fullResumeData.certificates.filter(cert => config.certificates?.items[cert.id]?.included);

        return data;
    }, [fullResumeData, config]);

    const previewHtml = useMemo<string | null>(() => {
        if (!filteredData) return null;
        const generator = templates.find(t => t.id === selectedTemplateId)?.generator;
        return generator ? generator(filteredData, {
            fontFamily: selectedFont,
            fontSize: fontSize,
            themeColor: themeColor,
            sectionOrder: sectionOrder.filter(key => config[key]?.included)
        }) : null;
    }, [filteredData, selectedTemplateId, selectedFont, fontSize, themeColor, sectionOrder, config]);


    const handleDownload = () => {
        if (previewHtml) {
            downloadFile(previewHtml, 'custom_cv.html', 'text/html');
        }
    };

    // Drag and Drop Handlers for Sections
    const handleSectionDragStart = (e: React.DragEvent<HTMLDivElement>, sectionKey: SectionKey) => {
        setDraggedSection(sectionKey);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', sectionKey);
    };

    const handleSectionDragOver = (e: React.DragEvent<HTMLDivElement>, sectionKey: SectionKey) => {
        e.preventDefault();
        if (draggedSection && draggedSection !== sectionKey) {
            setDragOverSection(sectionKey);
        }
    };

    const handleSectionDrop = (e: React.DragEvent<HTMLDivElement>, targetSection: SectionKey) => {
        e.preventDefault();
        if (draggedSection) {
            const newOrder = [...sectionOrder];
            const draggedIndex = newOrder.indexOf(draggedSection);
            const targetIndex = newOrder.indexOf(targetSection);
            
            if (draggedIndex > -1) {
                const [item] = newOrder.splice(draggedIndex, 1);
                newOrder.splice(targetIndex, 0, item);
                setSectionOrder(newOrder);
            }
        }
        setDraggedSection(null);
        setDragOverSection(null);
    };

     const handleSectionDragEnd = () => {
        setDraggedSection(null);
        setDragOverSection(null);
    };

    
    const Checkbox: React.FC<{id: string, label: React.ReactNode, checked: boolean, onChange: (checked: boolean) => void, className?: string}> = ({ id, label, checked, onChange, className }) => (
        <div className={`flex items-center ${className}`}>
            <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            <label htmlFor={id} className="ml-2 block text-sm text-gray-900">{label}</label>
        </div>
    );
    
    const renderSection = (sectionKey: SectionKey) => {
        if (!fullResumeData) return null;

        const isDragging = draggedSection === sectionKey;
        const isDragOver = dragOverSection === sectionKey;
        const commonProps = {
            key: sectionKey,
            draggable: true,
            onDragStart: (e: React.DragEvent<HTMLDivElement>) => handleSectionDragStart(e, sectionKey),
            onDragOver: (e: React.DragEvent<HTMLDivElement>) => handleSectionDragOver(e, sectionKey),
            onDrop: (e: React.DragEvent<HTMLDivElement>) => handleSectionDrop(e, sectionKey),
            onDragEnd: handleSectionDragEnd,
            onDragLeave: () => setDragOverSection(null),
            className: `bg-gray-50 p-3 rounded-md shadow-sm border border-transparent relative transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'}`
        };

        const dropIndicator = isDragOver && <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full" />;

        switch (sectionKey) {
            case 'summary':
                return (
                    <div {...commonProps}>
                        {dropIndicator}
                        <div className="flex items-center">
                             <GripVerticalIcon className="w-5 h-5 text-gray-400 mr-2 cursor-grab active:cursor-grabbing" />
                            <Checkbox id="check-summary" label={<h3 className="font-semibold text-gray-700">{SECTION_TITLES.summary}</h3>} checked={config.summary?.included || false} onChange={c => handleConfigChange(['summary', 'included'], c)} />
                        </div>
                        {config.summary?.included && <textarea value={config.summary?.text || ''} onChange={e => handleConfigChange(['summary', 'text'], e.target.value)} rows={5} className="p-2 border rounded-md w-full mt-2 text-sm" />}
                    </div>
                );
            case 'skills':
                return (
                    <div {...commonProps}>
                         {dropIndicator}
                        <div className="flex items-center">
                            <GripVerticalIcon className="w-5 h-5 text-gray-400 mr-2 cursor-grab active:cursor-grabbing" />
                            <Checkbox id="check-skills" label={<h3 className="font-semibold text-gray-700">{SECTION_TITLES.skills}</h3>} checked={config.skills?.included || false} onChange={c => handleConfigChange(['skills', 'included'], c)} />
                        </div>
                        {config.skills?.included && <div className="pl-5 mt-2 space-y-1 grid grid-cols-2 sm:grid-cols-3 gap-1">
                            {fullResumeData.skills.map((skill, i) => <Checkbox key={i} id={`skill-${i}`} label={skill} checked={config.skills?.items[`skill-${i}`]?.included || false} onChange={c => handleConfigChange(['skills', 'items', `skill-${i}`, 'included'], c)} />)}
                        </div>}
                    </div>
                );
            case 'experience':
                return (
                     <div {...commonProps}>
                         {dropIndicator}
                        <div className="flex items-center">
                             <GripVerticalIcon className="w-5 h-5 text-gray-400 mr-2 cursor-grab active:cursor-grabbing" />
                            <Checkbox id="check-exp" label={<h3 className="font-semibold text-gray-700">{SECTION_TITLES.experience}</h3>} checked={config.experience?.included || false} onChange={c => handleConfigChange(['experience', 'included'], c)} />
                        </div>
                        {config.experience?.included && <div className="pl-5 mt-2 space-y-3">
                            {fullResumeData.experience.map(exp => <div key={exp.id}>
                                <Checkbox id={`exp-${exp.id}`} label={<><strong className="text-blue-700">{exp.title}</strong> at {exp.company}</>} checked={config.experience?.items[exp.id]?.included || false} onChange={c => handleConfigChange(['experience', 'items', exp.id, 'included'], c)} />
                                {config.experience?.items[exp.id]?.included && <div className="pl-5 mt-1 space-y-1">
                                    {(exp.description || '').split('\n').filter(l=>l).map((line, i) => <Checkbox key={i} id={`exp-${exp.id}-b${i}`} label={<em className="truncate text-gray-600" title={line}>{line}</em>} checked={config.experience?.items[exp.id]?.bullets?.[i] || false} onChange={c => handleConfigChange(['experience', 'items', exp.id, 'bullets', i.toString()], c)} />)}
                                </div>}
                            </div>)}
                        </div>}
                    </div>
                );
            case 'projects':
                return (
                     <div {...commonProps}>
                         {dropIndicator}
                        <div className="flex items-center">
                            <GripVerticalIcon className="w-5 h-5 text-gray-400 mr-2 cursor-grab active:cursor-grabbing" />
                            <Checkbox id="check-proj" label={<h3 className="font-semibold text-gray-700">{SECTION_TITLES.projects}</h3>} checked={config.projects?.included || false} onChange={c => handleConfigChange(['projects', 'included'], c)} />
                        </div>
                        {config.projects?.included && <div className="pl-5 mt-2 space-y-3">
                            {fullResumeData.projects.map(proj => <div key={proj.id}>
                                <Checkbox id={`proj-${proj.id}`} label={<strong className="text-blue-700">{proj.name}</strong>} checked={config.projects?.items[proj.id]?.included || false} onChange={c => handleConfigChange(['projects', 'items', proj.id, 'included'], c)} />
                                 {config.projects?.items[proj.id]?.included && <div className="pl-5 mt-1 space-y-1">
                                    {(proj.description || '').split('\n').filter(l=>l).map((line, i) => <Checkbox key={i} id={`proj-${proj.id}-b${i}`} label={<em className="truncate text-gray-600" title={line}>{line}</em>} checked={config.projects?.items[proj.id]?.bullets?.[i] || false} onChange={c => handleConfigChange(['projects', 'items', proj.id, 'bullets', i.toString()], c)} />)}
                                </div>}
                            </div>)}
                        </div>}
                    </div>
                );
            case 'education':
                 return (
                     <div {...commonProps}>
                         {dropIndicator}
                        <div className="flex items-center">
                            <GripVerticalIcon className="w-5 h-5 text-gray-400 mr-2 cursor-grab active:cursor-grabbing" />
                            <Checkbox id="check-edu" label={<h3 className="font-semibold text-gray-700">{SECTION_TITLES.education}</h3>} checked={config.education?.included || false} onChange={c => handleConfigChange(['education', 'included'], c)} />
                        </div>
                        {config.education?.included && <div className="pl-5 mt-2 space-y-2">
                            {fullResumeData.education.map(edu => <Checkbox key={edu.id} id={`edu-${edu.id}`} label={`${edu.degree} at ${edu.school}`} checked={config.education?.items[edu.id]?.included || false} onChange={c => handleConfigChange(['education', 'items', edu.id, 'included'], c)} />)}
                        </div>}
                    </div>
                );
            case 'certificates':
                 return (
                     <div {...commonProps}>
                         {dropIndicator}
                        <div className="flex items-center">
                            <GripVerticalIcon className="w-5 h-5 text-gray-400 mr-2 cursor-grab active:cursor-grabbing" />
                            <Checkbox id="check-cert" label={<h3 className="font-semibold text-gray-700">{SECTION_TITLES.certificates}</h3>} checked={config.certificates?.included || false} onChange={c => handleConfigChange(['certificates', 'included'], c)} />
                        </div>
                        {config.certificates?.included && <div className="pl-5 mt-2 space-y-2">
                            {fullResumeData.certificates.map(cert => <Checkbox key={cert.id} id={`cert-${cert.id}`} label={`${cert.name} from ${cert.issuer}`} checked={config.certificates?.items[cert.id]?.included || false} onChange={c => handleConfigChange(['certificates', 'items', cert.id, 'included'], c)} />)}
                        </div>}
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <main className="grid grid-cols-1 lg:grid-cols-2 h-screen-minus-nav">
            <style>{`.h-screen-minus-nav { height: calc(100vh - 65px); }`}</style>
            {/* Left Panel */}
            <div className="bg-white p-6 overflow-y-auto">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">CV Customizer</h1>
                
                <div className="mb-4 bg-gray-50 p-4 rounded-lg border space-y-4">
                     <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">1. Load Resume Data</span>
                        <div className="flex space-x-2">
                             <select id="customizer-version-select" onChange={e => handleLoadVersion(e.target.value)} className="p-2 border rounded-md w-full bg-white" defaultValue="">
                                <option value="" disabled>-- from Stored Versions --</option>
                                {Object.keys(resumes).map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <label htmlFor="upload-json" className="cursor-pointer text-center whitespace-nowrap bg-white text-blue-700 font-semibold py-2 px-4 border border-blue-200 rounded-md hover:bg-blue-50">
                                Upload .json
                            </label>
                            <input type="file" id="upload-json" accept=".json" onChange={handleFileUpload} className="hidden" />
                        </div>
                    </div>
                </div>
                
                 <div className="mb-4 bg-gray-50 p-4 rounded-lg border">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">2. Design & Style</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="template-select" className="block text-xs font-medium text-gray-600 mb-1">Template</label>
                            <select id="template-select" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="p-2 border rounded-md w-full bg-white">
                                {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="font-select" className="block text-xs font-medium text-gray-600 mb-1">Font Family</label>
                            <select id="font-select" value={selectedFont} onChange={e => setSelectedFont(e.target.value)} className="p-2 border rounded-md w-full bg-white">
                                {FONT_OPTIONS.map(font => <option key={font} value={font}>{font}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="font-size-select" className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
                            <select id="font-size-select" value={fontSize} onChange={e => setFontSize(e.target.value as FontSize)} className="p-2 border rounded-md w-full bg-white">
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                            </select>
                        </div>
                         <div>
                            <label htmlFor="theme-color-select" className="block text-xs font-medium text-gray-600 mb-1">Theme Color</label>
                            <select id="theme-color-select" value={themeColor} onChange={e => setThemeColor(e.target.value as ThemeColor)} className="p-2 border rounded-md w-full bg-white">
                                {COLOR_OPTIONS.map(color => <option key={color.value} value={color.value}>{color.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mb-4 relative">
                    <label htmlFor="job-offer" className="block text-sm font-medium text-gray-700 mb-1">3. Paste Job Offer (for AI Optimization)</label>
                    <textarea id="job-offer" value={jobOffer} onChange={e => setJobOffer(e.target.value)} rows={6} placeholder="Paste job description here to enable AI optimization..." className="p-2 border rounded-md w-full"></textarea>
                    <button
                        onClick={handleAiOptimization}
                        disabled={!fullResumeData || !jobOffer || isOptimizing}
                        className="absolute bottom-2 right-2 bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-1 text-sm font-semibold transition-all duration-200"
                        title="Optimize summary and skills for this job"
                    >
                        {isOptimizing ? (
                            <>
                                <SpinnerIcon className="w-4 h-4" />
                                <span>Optimizing...</span>
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-4 h-4" />
                                <span>Optimize with AI</span>
                            </>
                        )}
                    </button>
                </div>
                
                <h3 className="text-sm font-medium text-gray-700 mb-2 mt-6">4. Customize Content</h3>
                <div className="space-y-4">
                    {!fullResumeData ? <p className="text-gray-500 text-center">Load a version or upload a file to see customization options.</p> : (
                        <>
                           {sectionOrder.map(key => renderSection(key))}
                        </>
                    )}
                </div>

                <div className="mt-8 border-t pt-4">
                    <button onClick={handleDownload} disabled={!fullResumeData} className="w-full bg-green-600 text-white text-lg font-bold px-8 py-3 rounded-lg shadow-lg hover:bg-green-700 transition duration-300 disabled:bg-gray-400 flex items-center justify-center space-x-2">
                        <DownloadIcon className="w-6 h-6" />
                        <span>Download Customized CV</span>
                    </button>
                </div>
            </div>

            {/* Right Panel */}
            <div className="bg-gray-200 p-4 lg:p-8 overflow-y-auto">
                <div className="bg-white shadow-lg mx-auto max-w-[8.5in]">
                    <CvPreview htmlContent={previewHtml} />
                </div>
            </div>
        </main>
    );
};

export default Customizer;
