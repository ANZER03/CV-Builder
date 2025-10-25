
import React, { useState, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEY } from '../constants';
import { ResumeData, Resumes, Experience, Project, Education, Certificate } from '../types';
import { downloadFile, readFileAsText } from '../utils/fileUtils';
import { DownloadIcon, TrashIcon, GripVerticalIcon } from './icons';

const emptyResumeData: ResumeData = {
    personal: { name: '', title: '', phone: '', email: '', location: '', linkedin: '', github: '', portfolio: '' },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certificates: [],
};

type DynamicSection = 'experience' | 'projects' | 'education' | 'certificates';

/**
 * Ensures that every item in the dynamic sections of the resume data has a unique ID.
 * This is crucial for data loaded from external sources (like JSON files or older local storage versions)
 * that may not have IDs, preventing bugs in editing and deleting items.
 * @param data The resume data to process.
 * @returns A new resume data object with guaranteed unique IDs for all dynamic items.
 */
const ensureUniqueIds = (data: ResumeData): ResumeData => {
    const newData = JSON.parse(JSON.stringify(data)); // Deep copy to avoid mutation

    const processSection = <T extends { id?: string }>(section: T[] | undefined): T[] => {
        if (!Array.isArray(section)) return [];
        return section.map(item => ({
            ...item,
            id: item.id || crypto.randomUUID(),
        }));
    };

    newData.experience = processSection(newData.experience);
    newData.projects = processSection(newData.projects);
    newData.education = processSection(newData.education);
    newData.certificates = processSection(newData.certificates);

    return newData;
};

const InfoHub: React.FC = () => {
    const [resumes, setResumes] = useLocalStorage<Resumes>(STORAGE_KEY, {});
    const [formData, setFormData] = useState<ResumeData>(emptyResumeData);
    const [currentVersionName, setCurrentVersionName] = useState<string | null>(null);
    const [saveVersionName, setSaveVersionName] = useState('');
    const [newSkill, setNewSkill] = useState('');

    // State for drag-and-drop
    const [draggedItem, setDraggedItem] = useState<{ id: string; section: DynamicSection } | null>(null);
    const [dragOverInfo, setDragOverInfo] = useState<{ id: string; section: DynamicSection } | null>(null);


    const handleLoadVersion = (name: string) => {
        if (!name || !resumes[name]) return;
        const loadedData = ensureUniqueIds(resumes[name]);
        setFormData(loadedData);
        setCurrentVersionName(name);
        setSaveVersionName(name);
    };

    const handleDeleteVersion = (name: string) => {
        if (!name || !resumes[name]) return;
        if (window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
            const newResumes = { ...resumes };
            delete newResumes[name];
            setResumes(newResumes);
            if (currentVersionName === name) {
                setFormData(emptyResumeData);
                setCurrentVersionName(null);
                setSaveVersionName('');
            }
        }
    };
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await readFileAsText(file);
            const jsonData = JSON.parse(text) as ResumeData;
            const sanitizedData = ensureUniqueIds(jsonData);
            setFormData(sanitizedData);
            setSaveVersionName(file.name.replace('.json', '') || 'Uploaded Version');
            setCurrentVersionName(null);
        } catch (error) {
            console.error("Error reading or parsing file:", error);
            alert("Failed to load JSON file. Please check the file format.");
        }
         // Reset file input to allow uploading the same file name again
        event.target.value = '';
    };

    const handleSaveNewVersion = () => {
        if (!saveVersionName.trim()) {
            alert("Please enter a version name.");
            return;
        }
        if (resumes[saveVersionName] && !window.confirm(`A version named "${saveVersionName}" already exists. Overwrite it?`)) {
            return;
        }
        setResumes(prev => ({ ...prev, [saveVersionName]: formData }));
        setCurrentVersionName(saveVersionName);
    };

    const handleUpdateCurrentVersion = () => {
        if (!currentVersionName) return;
        setResumes(prev => ({ ...prev, [currentVersionName]: formData }));
    };

    const handleDownloadJson = () => {
        downloadFile(JSON.stringify(formData, null, 2), `${saveVersionName || 'resume'}.json`, 'application/json');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, section: keyof ResumeData, field: string) => {
        if (section === 'personal') {
            setFormData(prev => ({
                ...prev,
                personal: { ...prev.personal, [field]: e.target.value }
            }));
        } else if (typeof formData[section] === 'string') {
             setFormData(prev => ({ ...prev, [section]: e.target.value }));
        }
    };
    
    const handleDynamicItemChange = (id: string, field: string, value: string, section: DynamicSection) => {
        setFormData(prev => {
            const updatedSection = (prev[section] as any[]).map(item => {
                if (item.id === id) {
                    return { ...item, [field]: value };
                }
                return item;
            });

            return {
                ...prev,
                [section]: updatedSection,
            };
        });
    };

    const addDynamicItem = (section: DynamicSection) => {
        const newItem = { id: crypto.randomUUID() };
        let fullNewItem: any;

        switch (section) {
            case 'experience':
                fullNewItem = { ...newItem, title: '', company: '', location: '', dates: '', description: '' };
                break;
            case 'projects':
                fullNewItem = { ...newItem, name: '', tools: '', description: '' };
                break;
            case 'education':
                fullNewItem = { ...newItem, school: '', location: '', degree: '', dates: '' };
                break;
            case 'certificates':
                fullNewItem = { ...newItem, name: '', issuer: '', date: '' };
                break;
        }
        setFormData(prev => ({ ...prev, [section]: [...prev[section], fullNewItem] }));
    };

    const removeDynamicItem = (id: string, section: DynamicSection) => {
        setFormData(prev => {
            const updatedSection = (prev[section] as { id: string }[]).filter(item => item.id !== id);
            return {
                ...prev,
                [section]: updatedSection
            };
        });
    };

    const handleAddSkill = () => {
        if (newSkill.trim()) {
            setFormData(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
            setNewSkill('');
        }
    };

    const handleRemoveSkill = (index: number) => {
        setFormData(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string, section: DynamicSection) => {
        setDraggedItem({ id, section });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string, section: DynamicSection) => {
        e.preventDefault();
        if (draggedItem?.id !== id && draggedItem?.section === section) {
            setDragOverInfo({ id, section });
        }
    };

    const handleDragLeave = () => {
        setDragOverInfo(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string, section: DynamicSection) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.section !== section || draggedItem.id === targetId) {
            setDraggedItem(null);
            setDragOverInfo(null);
            return;
        }

        setFormData(prev => {
            const sectionData = [...(prev[section] as any[])];
            const draggedIndex = sectionData.findIndex(item => item.id === draggedItem.id);
            const targetIndex = sectionData.findIndex(item => item.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return prev;

            const [removed] = sectionData.splice(draggedIndex, 1);
            sectionData.splice(targetIndex, 0, removed);

            return { ...prev, [section]: sectionData };
        });

        setDraggedItem(null);
        setDragOverInfo(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverInfo(null);
    };


    return (
        <main className="max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Info Hub</h1>
            <p className="text-gray-600 mb-6">Fill in all your professional details. This data is saved in your browser and can be exported.</p>

            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Manage Resumes</h2>
                <div className="mb-4">
                    <label htmlFor="resume-version-select" className="block text-sm font-medium text-gray-700 mb-1">Load Stored Version</label>
                    <div className="flex items-center space-x-2">
                        <select id="resume-version-select" value={currentVersionName || ''} onChange={e => handleLoadVersion(e.target.value)} className="p-2 border rounded-md w-full bg-white">
                            <option value="">-- Select a version --</option>
                            {Object.keys(resumes).map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button onClick={() => handleDeleteVersion(currentVersionName || '')} className="bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 disabled:bg-gray-400" disabled={!currentVersionName}><TrashIcon /></button>
                    </div>
                </div>
                <div>
                    <label htmlFor="upload-info-json" className="block text-sm font-medium text-gray-700 mb-1">Upload `resume.json` File</label>
                    <input type="file" id="upload-info-json" accept=".json" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
            </div>

            <div className="space-y-6">
                {/* Form Sections */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Personal Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={formData.personal.name} onChange={e => handleInputChange(e, 'personal', 'name')} type="text" placeholder="Full Name" className="p-2 border rounded-md w-full" />
                        <input value={formData.personal.title} onChange={e => handleInputChange(e, 'personal', 'title')} type="text" placeholder="Job Title" className="p-2 border rounded-md w-full" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Contact Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input value={formData.personal.phone} onChange={e => handleInputChange(e, 'personal', 'phone')} type="text" placeholder="Phone" className="p-2 border rounded-md w-full" />
                        <div className="relative">
                            <input value={formData.personal.email} onChange={e => handleInputChange(e, 'personal', 'email')} type="email" placeholder="Email" className="p-2 border rounded-md w-full pr-8" />
                            {formData.personal.email && (
                                <a href={`mailto:${formData.personal.email}`} target="_blank" rel="noopener noreferrer" title="Send email" className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                                </a>
                            )}
                        </div>
                        <input value={formData.personal.location} onChange={e => handleInputChange(e, 'personal', 'location')} type="text" placeholder="Location" className="p-2 border rounded-md w-full" />
                        <div className="relative">
                            <input value={formData.personal.linkedin} onChange={e => handleInputChange(e, 'personal', 'linkedin')} type="url" placeholder="LinkedIn URL" className="p-2 border rounded-md w-full pr-8" />
                            {formData.personal.linkedin && (
                                <a href={formData.personal.linkedin} target="_blank" rel="noopener noreferrer" title="Open LinkedIn profile" className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-blue-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                                </a>
                            )}
                        </div>
                        <input value={formData.personal.github} onChange={e => handleInputChange(e, 'personal', 'github')} type="url" placeholder="GitHub URL" className="p-2 border rounded-md w-full" />
                        <input value={formData.personal.portfolio} onChange={e => handleInputChange(e, 'personal', 'portfolio')} type="url" placeholder="Portfolio URL" className="p-2 border rounded-md w-full" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Professional Summary</h2>
                    <textarea value={formData.summary} onChange={e => handleInputChange(e, 'summary', 'summary')} rows={5} placeholder="Write your professional summary here..." className="p-2 border rounded-md w-full"></textarea>
                </div>
                
                 {/* Skills */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Skills</h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {formData.skills.map((skill, index) => (
                            <div key={index} className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                                {skill}
                                <button onClick={() => handleRemoveSkill(index)} className="ml-2 text-blue-600 hover:text-blue-800">&times;</button>
                            </div>
                        ))}
                    </div>
                    <div className="flex space-x-2">
                        <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddSkill()} type="text" placeholder="e.g., Python" className="p-2 border rounded-md w-full" />
                        <button onClick={handleAddSkill} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 whitespace-nowrap">Add Skill</button>
                    </div>
                </div>

                {/* Experience */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Work Experience</h2>
                    <div className="space-y-4 mb-4">
                        {formData.experience.map((item) => {
                             const isDragging = draggedItem?.id === item.id;
                             const isDragOver = dragOverInfo?.id === item.id;
                             return (
                                <div 
                                    key={item.id} 
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, item.id, 'experience')}
                                    onDragOver={(e) => handleDragOver(e, item.id, 'experience')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, item.id, 'experience')}
                                    onDragEnd={handleDragEnd}
                                    className={`p-4 pl-10 border border-gray-200 rounded-lg bg-gray-50 shadow-sm relative transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'} ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                >
                                    <div className="absolute top-1/2 -translate-y-1/2 left-2 text-gray-400 cursor-grab active:cursor-grabbing">
                                        <GripVerticalIcon className="w-5 h-5" />
                                    </div>
                                    <button onClick={() => removeDynamicItem(item.id, 'experience')} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Remove experience">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                                        <input value={item.title} onChange={e => handleDynamicItemChange(item.id, 'title', e.target.value, 'experience')} type="text" placeholder="Job Title" className="p-2 border rounded-md w-full" />
                                        <input value={item.company} onChange={e => handleDynamicItemChange(item.id, 'company', e.target.value, 'experience')} type="text" placeholder="Company" className="p-2 border rounded-md w-full" />
                                        <input value={item.location} onChange={e => handleDynamicItemChange(item.id, 'location', e.target.value, 'experience')} type="text" placeholder="Location" className="p-2 border rounded-md w-full" />
                                        <input value={item.dates} onChange={e => handleDynamicItemChange(item.id, 'dates', e.target.value, 'experience')} type="text" placeholder="Dates" className="p-2 border rounded-md w-full" />
                                    </div>
                                    <textarea value={item.description} onChange={e => handleDynamicItemChange(item.id, 'description', e.target.value, 'experience')} rows={4} placeholder="Description (one bullet per line)" className="p-2 border rounded-md w-full"></textarea>
                                </div>
                            )
                        })}
                    </div>
                    <button onClick={() => addDynamicItem('experience')} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Add Experience</button>
                </div>
                
                 {/* Projects */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Personal Projects</h2>
                    <div className="space-y-4 mb-4">
                        {formData.projects.map((item) => {
                             const isDragging = draggedItem?.id === item.id;
                             const isDragOver = dragOverInfo?.id === item.id;
                             return (
                                <div 
                                    key={item.id} 
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, item.id, 'projects')}
                                    onDragOver={(e) => handleDragOver(e, item.id, 'projects')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, item.id, 'projects')}
                                    onDragEnd={handleDragEnd}
                                    className={`p-4 pl-10 border border-gray-200 rounded-lg bg-gray-50 shadow-sm relative transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'} ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                >
                                    <div className="absolute top-1/2 -translate-y-1/2 left-2 text-gray-400 cursor-grab active:cursor-grabbing">
                                        <GripVerticalIcon className="w-5 h-5" />
                                    </div>
                                    <button onClick={() => removeDynamicItem(item.id, 'projects')} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Remove project">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                                        <input value={item.name} onChange={e => handleDynamicItemChange(item.id, 'name', e.target.value, 'projects')} type="text" placeholder="Project Name" className="p-2 border rounded-md w-full" />
                                        <input value={item.tools} onChange={e => handleDynamicItemChange(item.id, 'tools', e.target.value, 'projects')} type="text" placeholder="Tools" className="p-2 border rounded-md w-full" />
                                    </div>
                                    <textarea value={item.description} onChange={e => handleDynamicItemChange(item.id, 'description', e.target.value, 'projects')} rows={3} placeholder="Description (one bullet per line)" className="p-2 border rounded-md w-full"></textarea>
                                </div>
                            )
                        })}
                    </div>
                    <button onClick={() => addDynamicItem('projects')} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Add Project</button>
                </div>
                
                {/* Education */}
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Education</h2>
                    <div className="space-y-4 mb-4">
                        {formData.education.map((item) => {
                            const isDragging = draggedItem?.id === item.id;
                            const isDragOver = dragOverInfo?.id === item.id;
                            return (
                                <div 
                                    key={item.id} 
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, item.id, 'education')}
                                    onDragOver={(e) => handleDragOver(e, item.id, 'education')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, item.id, 'education')}
                                    onDragEnd={handleDragEnd}
                                    className={`p-4 pl-10 border border-gray-200 rounded-lg bg-gray-50 shadow-sm relative transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'} ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                >
                                    <div className="absolute top-1/2 -translate-y-1/2 left-2 text-gray-400 cursor-grab active:cursor-grabbing">
                                        <GripVerticalIcon className="w-5 h-5" />
                                    </div>
                                    <button onClick={() => removeDynamicItem(item.id, 'education')} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Remove education">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input value={item.school} onChange={e => handleDynamicItemChange(item.id, 'school', e.target.value, 'education')} type="text" placeholder="School" className="p-2 border rounded-md w-full" />
                                        <input value={item.location} onChange={e => handleDynamicItemChange(item.id, 'location', e.target.value, 'education')} type="text" placeholder="Location" className="p-2 border rounded-md w-full" />
                                        <input value={item.degree} onChange={e => handleDynamicItemChange(item.id, 'degree', e.target.value, 'education')} type="text" placeholder="Degree/Major" className="p-2 border rounded-md w-full" />
                                        <input value={item.dates} onChange={e => handleDynamicItemChange(item.id, 'dates', e.target.value, 'education')} type="text" placeholder="Dates" className="p-2 border rounded-md w-full" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <button onClick={() => addDynamicItem('education')} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Add Education</button>
                </div>

                {/* Certificates */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Certificates</h2>
                    <div className="space-y-4 mb-4">
                        {formData.certificates.map((item) => {
                            const isDragging = draggedItem?.id === item.id;
                            const isDragOver = dragOverInfo?.id === item.id;
                            return (
                                <div 
                                    key={item.id} 
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, item.id, 'certificates')}
                                    onDragOver={(e) => handleDragOver(e, item.id, 'certificates')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, item.id, 'certificates')}
                                    onDragEnd={handleDragEnd}
                                    className={`p-4 pl-10 border border-gray-200 rounded-lg bg-gray-50 shadow-sm relative transition-all duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'} ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                >
                                    <div className="absolute top-1/2 -translate-y-1/2 left-2 text-gray-400 cursor-grab active:cursor-grabbing">
                                        <GripVerticalIcon className="w-5 h-5" />
                                    </div>
                                    <button onClick={() => removeDynamicItem(item.id, 'certificates')} className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 transition-colors" title="Remove certificate">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <input value={item.name} onChange={e => handleDynamicItemChange(item.id, 'name', e.target.value, 'certificates')} type="text" placeholder="Certificate Name" className="p-2 border rounded-md w-full" />
                                        <input value={item.issuer} onChange={e => handleDynamicItemChange(item.id, 'issuer', e.target.value, 'certificates')} type="text" placeholder="Issuer" className="p-2 border rounded-md w-full" />
                                        <input value={item.date} onChange={e => handleDynamicItemChange(item.id, 'date', e.target.value, 'certificates')} type="text" placeholder="Date" className="p-2 border rounded-md w-full" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <button onClick={() => addDynamicItem('certificates')} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Add Certificate</button>
                </div>
            </div>

            <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">Save & Export</h2>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
                    <input value={saveVersionName} onChange={e => setSaveVersionName(e.target.value)} type="text" placeholder="Enter version name" className="p-2 border rounded-md w-full" />
                    <button onClick={handleSaveNewVersion} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 w-full sm:w-auto whitespace-nowrap">Save as New</button>
                </div>
                <button onClick={handleUpdateCurrentVersion} disabled={!currentVersionName} className="bg-yellow-500 text-white w-full px-4 py-2 rounded-md hover:bg-yellow-600 disabled:bg-gray-400 mb-4">Update Current Version</button>
                <button onClick={handleDownloadJson} className="bg-gray-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-800 transition duration-300 w-full flex items-center justify-center space-x-2">
                   <DownloadIcon className="w-5 h-5" />
                   <span>Download as .json Backup</span>
                </button>
            </div>
        </main>
    );
};

export default InfoHub;
