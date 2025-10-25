
import { ResumeData } from '../types';
import { generateModernCvHtml } from './modernTemplate';
import { generateClassicCvHtml } from './classicTemplate';

export interface TemplateOptions {
    fontFamily: string;
    fontSize: 'small' | 'medium' | 'large';
    themeColor: 'blue' | 'gray' | 'green' | 'purple';
    sectionOrder: string[];
}

export interface Template {
    id: string;
    name: string;
    generator: (data: ResumeData, options: TemplateOptions) => string;
}

export const templates: Template[] = [
    {
        id: 'modern',
        name: 'Modern',
        generator: generateModernCvHtml,
    },
    {
        id: 'classic',
        name: 'Classic',
        generator: generateClassicCvHtml,
    },
];
