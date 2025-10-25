
export interface PersonalInfo {
    name: string;
    title: string;
    phone: string;
    email: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
}

export interface Experience {
    id: string;
    title: string;
    company: string;
    location: string;
    dates: string;
    description: string;
}

export interface Project {
    id: string;
    name: string;
    tools: string;
    description: string;
}

export interface Education {
    id: string;
    school: string;
    location: string;
    degree: string;
    dates: string;
}

export interface Certificate {
    id: string;
    name: string;
    issuer: string;
    date: string;
}

export interface ResumeData {
    personal: PersonalInfo;
    summary: string;
    skills: string[];
    experience: Experience[];
    projects: Project[];
    education: Education[];
    certificates: Certificate[];
}

export interface Resumes {
    [key: string]: ResumeData;
}
