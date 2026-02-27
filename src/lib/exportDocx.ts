import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { Session, AudioEntry, ExpandedInsights } from '../types';

export const exportDocx = async (session: Session, entries: AudioEntry[], reportDetails: any) => {
    const children: any[] = [];

    // --- Session Header ---
    children.push(
        new Paragraph({
            text: session.title || 'Session Notes',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        })
    );

    if (session.subtitle) {
        children.push(
            new Paragraph({
                text: session.subtitle,
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            })
        );
    }

    // --- Session Notes ---
    if (session.notes) {
        children.push(
            new Paragraph({
                text: "Session Notes",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            })
        );
        // Split by newlines so we preserve paragraph breaks
        const noteLines = session.notes.split('\n');
        for (const line of noteLines) {
            if (line.trim()) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: line, size: 22 })], // size is half-points, 24 = 12pt
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
                text: "Consolidated Session Report",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            })
        );

        const r = reportDetails.report || reportDetails;

        // Strict Summary (New Shape Base)
        if (r.strictSummary && Array.isArray(r.strictSummary)) {
            children.push(
                new Paragraph({
                    text: "Strict Summary",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                })
            );
            for (const item of r.strictSummary) {
                children.push(
                    new Paragraph({
                        text: item,
                        bullet: { level: 0 },
                        spacing: { after: 100 }
                    })
                );
            }
        }

        // Expanded Insights (New Shape Base)
        if (r.expandedInsights) {
            children.push(
                new Paragraph({
                    text: "Expanded Insights",
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 200 }
                })
            );

            const sections = [
                { title: 'Drills', data: r.expandedInsights.drills },
                { title: 'Homework', data: r.expandedInsights.homework },
                { title: 'Technical Expansion', data: r.expandedInsights.technicalExpansion },
                { title: 'Emotional Notes', data: r.expandedInsights.emotionalNotes }
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
                                bullet: { level: 0 },
                                spacing: { after: 100 }
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
                                bullet: { level: 0 },
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
                                        bullet: { level: 0 },
                                        spacing: { after: 100 }
                                    })
                                );
                            }
                        } else {
                            children.push(
                                new Paragraph({
                                    text: `${subKey}: ${subValue}`,
                                    bullet: { level: 0 },
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
        let consolidatedTranscripts = null;
        if (r.transcripts && Array.isArray(r.transcripts)) {
            consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        }
        if (consolidatedTranscripts) {
            children.push(
                new Paragraph({
                    text: "Raw Transcript",
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

    // --- Audio Entries (Clips/Live) ---
    if (entries.length > 0) {
        children.push(
            new Paragraph({
                text: "Audio Entries",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 600, after: 200 }
            })
        );

        for (const audio of entries) {
            const time = format(new Date(audio.timestamp), "HH:mm");
            const displayTitle = audio.filename || `Audio Entry`;

            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: displayTitle, bold: true, size: 28 }),
                        new TextRun({ text: `  |  ${time}h - ${audio.type === 'recording' ? 'Live' : 'Clip'}`, color: "888888", size: 24 })
                    ],
                    spacing: { before: 400, after: 200 }
                })
            );

            if (audio.strictSummary && Array.isArray(audio.strictSummary)) {
                children.push(
                    new Paragraph({
                        text: "Strict Summary",
                        heading: HeadingLevel.HEADING_3,
                        spacing: { after: 100 }
                    })
                );
                for (const item of audio.strictSummary) {
                    children.push(
                        new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 100 } })
                    );
                }
            }

            if (audio.expandedInsights) {
                const sections = [
                    { title: 'Drills', data: audio.expandedInsights.drills },
                    { title: 'Homework', data: audio.expandedInsights.homework },
                    { title: 'Technical Expansion', data: audio.expandedInsights.technicalExpansion },
                    { title: 'Emotional Notes', data: audio.expandedInsights.emotionalNotes }
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
                                    bullet: { level: 0 },
                                    spacing: { after: 100 }
                                })
                            );
                        }
                    }
                }
            }

            if (audio.transcript) {
                children.push(
                    new Paragraph({
                        text: "Raw Transcript",
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
        }
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });

    const blob = await Packer.toBlob(doc);
    const dateStr = format(new Date(session.date), "yyyy-MM-dd");
    let fileName = `Session_${dateStr}`;
    if (session.title) {
        // Clean title for file name
        const safeTitle = session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        fileName = `${safeTitle}`;
    }

    saveAs(blob, `${fileName}.docx`);
};
