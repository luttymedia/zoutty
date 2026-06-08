import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, ImageRun, BorderStyle } from 'docx';
import { ZOUTTY_LOGO_B64 } from './logoBase64';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { Session, AudioEntry } from '../types';

export interface ExportOptions {
    includeTranscripts?: boolean;
}

export const exportDocx = async (session: Session, entries: AudioEntry[], reportDetails: any, t?: (key: string, vars?: any) => string, options?: ExportOptions) => {
    let logoBytes: Uint8Array | null = null;
    try {
        const binaryString = window.atob(ZOUTTY_LOGO_B64);
        const len = binaryString.length;
        logoBytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            logoBytes[i] = binaryString.charCodeAt(i);
        }
    } catch (e) {
        console.warn('Failed to decode Zoutty base64 logo for export', e);
    }

    const children: any[] = [];

    const translate = (key: string, fallback: string, vars?: any) => {
        if (t) {
            const val = t(key, vars);
            if (val && val !== key) return val;
        }
        return fallback;
    };

    // --- Session Header ---
    children.push(
        new Paragraph({
            text: session.title || translate('appSubtitle', 'Session Notes'),
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
        })
    );

    if (session.subtitle) {
        children.push(
            new Paragraph({
                text: session.subtitle,
                heading: HeadingLevel.HEADING_4,
                spacing: { after: 400 }
            })
        );
    }

    // --- Session Notes ---
    if (session.notes) {
        children.push(
            new Paragraph({
                text: translate('session.notesHeading', 'Notes'),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 }
            })
        );
        // Split by newlines so we preserve paragraph breaks
        const noteLines = session.notes.split('\n');
        for (const line of noteLines) {
            if (line.trim()) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: line, size: 20 })], // size is half-points, 20 = 10pt
                        spacing: { after: 120 }
                    })
                );
            }
        }
    }

    // --- Consolidated Report ---
    const hasReport = reportDetails && Object.keys(reportDetails).length > 0;
    if (hasReport) {
        children.push(
            new Paragraph({
                text: translate('session.consolidatedReport', 'Consolidated Session Report'),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 }
            })
        );

        const r = reportDetails.report || reportDetails;

        // Strict Summary (New Shape Base)
        if (r.strictSummary && Array.isArray(r.strictSummary)) {
            children.push(
                new Paragraph({
                    text: translate('session.strictSummary', 'Strict Summary'),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                })
            );
            for (const item of r.strictSummary) {
                children.push(
                    new Paragraph({
                        text: item,
                        numbering: { reference: "small-bullets", level: 0 },
                        spacing: { after: 100 }
                    })
                );
            }
        }

        // Expanded Insights (New Shape Base)
        if (r.expandedInsights) {
            children.push(
                new Paragraph({
                    text: translate('session.expandedInsights', 'Expanded Insights'),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 200 }
                })
            );

            const sections = [
                { title: translate('session.drills', 'Drills'), data: r.expandedInsights.drills },
                { title: translate('session.homework', 'Homework'), data: r.expandedInsights.homework },
                { title: translate('session.technicalExpansion', 'Technical Expansion'), data: r.expandedInsights.technicalExpansion },
                { title: translate('session.emotionalNotes', 'Emotional Notes'), data: r.expandedInsights.emotionalNotes }
            ];

            for (const section of sections) {
                if (section.data && Array.isArray(section.data) && section.data.length > 0) {
                    children.push(
                        new Paragraph({
                            text: section.title,
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 200, after: 100 }
                        })
                    );
                    for (const item of section.data) {
                        children.push(
                            new Paragraph({
                                text: item,
                                style: "InsightSection"
                            })
                        );
                    }
                }
            }
        }

        // Legacy Report Generation
        if (!r.strictSummary && !r.expandedInsights) {
            // Iterate through old object structure
            for (const [key, value] of Object.entries(r)) {
                if (key === 'transcripts') continue;
                if (!value || (Array.isArray(value) && value.length === 0)) continue;

                const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                children.push(
                    new Paragraph({
                        text: title,
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 }
                    })
                );

                if (Array.isArray(value)) {
                    for (const item of value) {
                        const text = typeof item === 'string' ? item : (item as any).bullet || JSON.stringify(item);
                        children.push(
                            new Paragraph({
                                text: text,
                                numbering: { reference: "small-bullets", level: 0 },
                                spacing: { after: 100 }
                            })
                        );
                    }
                } else if (typeof value === 'object') {
                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (Array.isArray(subValue)) {
                            for (const item of subValue) {
                                children.push(
                                    new Paragraph({
                                        text: `${subKey}: ${item}`,
                                        numbering: { reference: "small-bullets", level: 0 },
                                        spacing: { after: 100 }
                                    })
                                );
                            }
                        } else {
                            children.push(
                                new Paragraph({
                                    text: `${subKey}: ${subValue}`,
                                    numbering: { reference: "small-bullets", level: 0 },
                                    spacing: { after: 100 }
                                })
                            );
                        }
                    }
                } else {
                    children.push(
                        new Paragraph({
                            text: String(value),
                            spacing: { after: 100 }
                        })
                    );
                }
            }
        }


        // Transcripts in Consolidated Report
        if (options?.includeTranscripts !== false) {
            let consolidatedTranscripts = null;
            if (r.transcripts && Array.isArray(r.transcripts)) {
                consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
            }
            if (consolidatedTranscripts) {
                children.push(
                    new Paragraph({
                        text: translate('session.rawTranscript', 'Raw Transcript'),
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 300, after: 200 }
                    })
                );

                const lines = consolidatedTranscripts.split('\n');
                for (const line of lines) {
                    children.push(
                        new Paragraph({
                            children: [new TextRun({ text: line, italics: true, color: "666666" })],
                            spacing: { after: 120 }
                        })
                    );
                }
            }
        }
    }

    // --- Audio Entries (Clips/Live) ---
    if (entries.length > 0) {
        children.push(
            new Paragraph({
                text: translate('home.sessionsHeading', 'Audio Entries'),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 600, after: 200 }
            })
        );

        entries.forEach((audio, idx) => {
            const time = format(new Date(audio.timestamp), "HH:mm");
            const displayTitle = audio.filename || translate('session.audioEntryDefault', 'Audio Entry', { index: entries.length - idx });
            const typeLabel = audio.type === 'recording' ? translate('session.liveType', 'Live') : translate('session.clipType', 'Clip');

            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: displayTitle, bold: true, size: 20 }),
                        new TextRun({ text: `  |  ${time}h - ${typeLabel}`, color: "888888", size: 20 })
                    ],
                    spacing: { before: 400, after: 200 }
                })
            );

            if (audio.strictSummary && Array.isArray(audio.strictSummary)) {
                children.push(
                    new Paragraph({
                        text: translate('session.strictSummary', 'Strict Summary'),
                        heading: HeadingLevel.HEADING_3,
                        spacing: { after: 100 }
                    })
                );
                for (const item of audio.strictSummary) {
                    children.push(
                        new Paragraph({ text: item, numbering: { reference: "small-bullets", level: 0 }, spacing: { after: 100 } })
                    );
                }
            }

            if (audio.expandedInsights) {
                const sections = [
                    { title: translate('session.drills', 'Drills'), data: audio.expandedInsights.drills },
                    { title: translate('session.homework', 'Homework'), data: audio.expandedInsights.homework },
                    { title: translate('session.technicalExpansion', 'Technical Expansion'), data: audio.expandedInsights.technicalExpansion },
                    { title: translate('session.emotionalNotes', 'Emotional Notes'), data: audio.expandedInsights.emotionalNotes }
                ];

                for (const section of sections) {
                    if (section.data && Array.isArray(section.data) && section.data.length > 0) {
                        children.push(
                            new Paragraph({
                                text: section.title,
                                heading: HeadingLevel.HEADING_3,
                                spacing: { before: 200, after: 100 }
                            })
                        );
                        for (const item of section.data) {
                            children.push(
                                new Paragraph({
                                    text: item,
                                    style: "InsightSection"
                                })
                            );
                        }
                    }
                }
            }

            if (audio.transcript && options?.includeTranscripts !== false) {
                children.push(
                    new Paragraph({
                        text: translate('session.rawTranscript', 'Raw Transcript'),
                        heading: HeadingLevel.HEADING_3,
                        spacing: { before: 200, after: 100 }
                    })
                );

                const lines = audio.transcript.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        children.push(
                            new Paragraph({
                                children: [new TextRun({ text: line, italics: true, color: "666666" })],
                                spacing: { after: 100 }
                            })
                        );
                    }
                }
            }
        });
    }

    const doc = new Document({
        numbering: {
            config: [
                {
                    reference: "small-bullets",
                    levels: [
                        {
                            level: 0,
                            format: "bullet",
                            text: "·",
                            alignment: AlignmentType.LEFT,
                            style: {
                                paragraph: {
                                    indent: { left: 360, hanging: 180 },
                                    spacing: { line: 276 }
                                },
                                run: {
                                    size: 20,
                                    color: "1F2937",
                                }
                            }
                        }
                    ]
                }
            ]
        },
        styles: {
            paragraphStyles: [
                {
                    id: "Normal",
                    name: "Normal",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        font: "Inter",
                        size: 20, // 10pt
                        color: "1F2937", // Charcoal Gray
                    },
                    paragraph: {
                        spacing: { line: 276 }, // 1.15 line height
                        alignment: AlignmentType.LEFT
                    }
                },
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        font: "Inter",
                        size: 28, // 14pt
                        bold: true,
                        color: "2DD4BF", // Teal
                    },
                    paragraph: {
                        spacing: { before: 400, after: 200 },
                    },
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        font: "Inter",
                        size: 24, // 12pt
                        bold: true,
                        color: "2DD4BF", // Teal
                    },
                    paragraph: {
                        spacing: { before: 300, after: 200 },
                    },
                },
                {
                    id: "Heading3",
                    name: "Heading 3",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        font: "Inter",
                        size: 22, // 11pt
                        bold: true,
                        color: "1F2937", // Charcoal Gray
                    },
                    paragraph: {
                        spacing: { before: 200, after: 100 },
                    },
                },
                {
                    id: "Heading4",
                    name: "Heading 4",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        font: "Inter",
                        size: 22, // 11pt
                        color: "1F2937", // Charcoal Gray
                    },
                    paragraph: {
                        spacing: { before: 100, after: 100 },
                    },
                },
                {
                    id: "InsightSection",
                    name: "Insight Section",
                    basedOn: "Normal",
                    next: "Normal",
                    paragraph: {
                        spacing: { before: 100, after: 100, line: 276 },
                        indent: { left: 200 },
                        border: {
                            left: { color: "2DD4BF", space: 100, value: BorderStyle.SINGLE, size: 24 },
                        }
                    }
                }
            ]
        },
        sections: [{
            ...(logoBytes ? {
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new ImageRun({
                                        data: logoBytes,
                                        transformation: { width: 160, height: 40 },
                                        type: "png"
                                    })
                                ],
                                spacing: { after: 400 }
                            })
                        ]
                    })
                }
            } : {}),
            properties: {},
            children: children
        }]
    });

    const blob = await Packer.toBlob(doc);
    const dateStr = format(new Date(session.date), "yyyy-MM-dd");
    let fileName = `Zoutty_${dateStr}`;
    if (session.title) {
        // Clean title for file name
        const safeTitle = session.title.replace(/[<>:"/\\|?*]/g, '_').trim();
        fileName = `Zoutty_${safeTitle}`;
    }

    saveAs(blob, `${fileName}.docx`);
};
