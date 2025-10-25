
import { ResumeData } from '../types';
import { TemplateOptions } from './index';

const FONT_SIZES = { small: '14px', medium: '16px', large: '18px' };
const THEME_COLORS = {
    blue: '#2563EB',
    gray: '#4B5563',
    green: '#059669',
    purple: '#7C3AED',
};

const generateClassicStyles = (options: TemplateOptions): string => {
    const { fontFamily, fontSize, themeColor } = options;
    const fontFallback = ['Georgia', 'Times New Roman', 'Merriweather'].includes(fontFamily) ? 'serif' : 'sans-serif';

    return `
<style>
    :root {
        --theme-color: ${THEME_COLORS[themeColor]};
    }

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    
    body {
        font-family: '${fontFamily}', ${fontFallback};
        font-size: ${FONT_SIZES[fontSize]};
        line-height: 1.5;
        color: #333;
        background-color: white;
        width: 100%;
        margin: 0;
        padding: 0 0.67in;
    }
    
    .resume-container {
        background-color: white;
        padding: 0;
        width: 100%;
        max-width: 100%;
    }
    
    .header {
        text-align: center;
        margin-bottom: 25px;
    }
    
    .name {
        font-size: 2.125em; /* Relative to body font-size */
        font-weight: 700;
        text-transform: uppercase;
        margin-bottom: 8px;
        letter-spacing: 1.5px;
        color: var(--theme-color);
    }
    
    .contact-info {
        font-size: 0.9375em;
        margin-bottom: 20px;
        color: #555;
    }
    
    .section-title {
        text-transform: uppercase;
        font-weight: 700;
        margin: 30px 0 15px 0;
        font-size: 1.125em;
        letter-spacing: 1px;
        text-align: center;
        padding-top: 15px;
        page-break-after: avoid;
        color: var(--theme-color);
    }
    
    .summary, .skills-content, .languages-content {
         font-size: 0.9375em;
         text-align: justify;
    }

    .summary {
        margin-bottom: 20px;
        text-align: justify;
    }

    .skills {
        margin-bottom: 20px;
    }

    .skills-content {
        text-align: center;
        color: #444;
    }
    
    .experience-item, .project-item {
        margin-bottom: 20px;
    }

    .education-item {
         margin-bottom: 12px;
         font-size: 0.9375em;
    }
    
    .item-title {
        font-weight: 700;
        font-size: 1em;
        page-break-after: avoid;
        color: #000;
    }
    
    .item-details {
        font-size: 0.9375em;
        margin-bottom: 8px;
        page-break-after: avoid;
        color: #555;
    }
    
    .item-details strong {
        color: #333;
        font-weight: 700;
    }

    .item-details em {
        font-style: italic;
    }
    
    .bullet-list {
        margin-left: 20px;
        list-style-type: disc;
        font-size: 0.9375em;
    }
    
    .bullet-list li {
        margin-bottom: 8px;
    }

    .certificate-item {
        margin-bottom: 12px;
        font-size: 0.9375em;
    }

    @media print {
        @page {
            margin-top: 0.5in;
            margin-left: 0.5in;
            margin-right: 0.5in;
            margin-bottom: 0.32in;
            size: letter;
        }
        body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            color: #000;
            padding: 0;
        }
        .resume-container {
            box-shadow: none !important;
            padding: 0;
        }
        .section-title {
            margin: 20px 0 10px 0;
            padding-top: 10px;
        }
        .experience-item, .project-item {
            margin-bottom: 12px;
        }
        .education-item {
            margin-bottom: 8px;
        }
        .contact-info, .skills-content, .item-details {
            color: #333;
        }
    }
</style>
`;
}

export const generateClassicCvHtml = (data: ResumeData, options: TemplateOptions): string => {
    const { sectionOrder } = options;

    const contactParts = [
        data.personal.phone,
        data.personal.email,
        data.personal.location,
        data.personal.linkedin,
        data.personal.github,
        data.personal.portfolio
    ].filter(part => part && part.trim() !== '');

    const createBulletPoints = (description: string) => {
        return description.split('\n').filter(line => line.trim() !== '').map(line => `<li>${line}</li>`).join('');
    };

    const sectionHtmlMap: { [key: string]: string } = {
        summary: data.summary ? `
            <div data-section="summary">
                <div class="section-title">Profil</div>
                <div class="summary">${data.summary}</div>
            </div>` : '',
        skills: data.skills && data.skills.length > 0 ? `
            <div data-section="skills">
                <div class="section-title">Compétences</div>
                <div class="skills">
                    <div class="skills-content">${data.skills.join(', ')}</div>
                </div>
            </div>` : '',
        experience: data.experience && data.experience.length > 0 ? `
            <div data-section="experience">
                <div class="section-title">Expériences Professionnelles</div>
                ${data.experience.map(item => `
                <div class="experience-item">
                    <div class="item-title">${item.title}</div>
                    <div class="item-details"><strong>${item.company}</strong> - ${item.location} | <em>${item.dates}</em></div>
                    <ul class="bullet-list">${createBulletPoints(item.description)}</ul>
                </div>`).join('')}
            </div>` : '',
        projects: data.projects && data.projects.length > 0 ? `
            <div data-section="projects">
                <div class="section-title">Projets Personnels</div>
                ${data.projects.map(item => `
                <div class="project-item">
                    <div class="item-title">${item.name}</div>
                    <div class="item-details"><em>Outils: ${item.tools}</em></div>
                    <ul class="bullet-list">${createBulletPoints(item.description)}</ul>
                </div>`).join('')}
            </div>` : '',
        education: data.education && data.education.length > 0 ? `
            <div data-section="education">
                <div class="section-title">Formation</div>
                ${data.education.map(item => `
                <div class="education-item">
                    <strong>${item.school}</strong>, ${item.location}<br>
                    <em>${item.degree}</em> | ${item.dates}
                </div>`).join('')}
            </div>` : '',
        certificates: data.certificates && data.certificates.length > 0 ? `
            <div data-section="certificates">
                <div class="section-title">Certificats</div>
                ${data.certificates.map(item => `
                <div class="certificate-item">
                    <strong>${item.name}:</strong> Délivré par ${item.issuer} | ${item.date}
                </div>`).join('')}
            </div>` : ''
    };

    const bodyContent = `
        <div class="resume-container">
            <div class="header">
                <div class="name">${data.personal.name}</div>
                <div class="contact-info">${contactParts.join(' | ')}</div>
            </div>
            ${sectionOrder.map(key => sectionHtmlMap[key] || '').join('')}
        </div>
    `;

    return `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CV - ${data.personal.name}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">
            ${generateClassicStyles(options)}
        </head>
        <body>
            ${bodyContent}
        </body>
        </html>
    `;
};
