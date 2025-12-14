
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Message, LearningMaterial, QuizQuestion } from '../types';

// Helper to initialize the AI client safely at runtime
const getAiClient = () => {
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {
    // Ignore process not defined errors
  }
  return new GoogleGenAI({ apiKey });
};

const SYSTEM_INSTRUCTION = `
אתה צלם מקצועי ומורה לצילום DSLR ברמה עולמית.
התפקיד שלך הוא ללמד את המשתמש עקרונות צילום (משולש החשיפה, קומפוזיציה, עדשות, תאורה).
התשובות שלך צריכות להיות קצרות, ענייניות, ומעודדות.
השתמש במונחים מקצועיים (צמצם, תריס, ISO, עומק שדה) אך הסבר אותם בפשטות אם צריך.
השפה היא עברית.
`;

export const sendMessageToTutor = async (history: Message[], newMessage: string): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Optimize: Limit history to last 10 messages to reduce latency and token usage
    const recentHistory = history
      .filter(h => !h.isLoading)
      .slice(-10) 
      .map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: recentHistory
    });

    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "מצטער, לא הצלחתי לייצר תשובה כרגע.";
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    return "אירעה שגיאה בתקשורת עם ה-AI. אנא בדוק את מפתח ה-API שלך.";
  }
};

export const analyzePhoto = async (base64Image: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: `
            נתח את התמונה הזו מבחינה מקצועית של צילום DSLR.
            אנא ספק ביקורת בונה בפורמט הבא (בעברית):
            1. **חשיפה**: האם התמונה מוארת היטב? מה אפשר לשפר ב-ISO/Tutter/Aperture?
            2. **קומפוזיציה**: חוק השלישים, הולכת עין, וכו'.
            3. **פוקוס וחדות**: האם הפוקוס במקום הנכון?
            4. **טיפ לשיפור**: עצה אחת מעשית לפעם הבאה.
            `
          },
        ],
      },
      config: {
        responseModalities: [Modality.TEXT],
      }
    });

    return response.text || "לא הצלחתי לנתח את התמונה.";
  } catch (error) {
    console.error("Error analyzing photo:", error);
    return "אירעה שגיאה בניתוח התמונה.";
  }
};

export const getSimulatorFeedback = async (aperture: number, shutter: number, iso: number): Promise<string> => {
  try {
     const ai = getAiClient();
     const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
      המשתמש הגדיר את המצלמה לערכים הבאים:
      צמצם: f/${aperture}
      מהירות תריס: 1/${shutter}
      ISO: ${iso}
      
      בקצרה (מקסימום 2 משפטים): מה תהיה התוצאה הוויזואלית של הגדרות אלו? התייחס לעומק שדה, מריחת תנועה, ורעש דיגיטלי.
      `,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
     });
     return response.text || "";
  } catch (error) {
    return "";
  }
};

// Helper to fetch blob from URL and convert to Base64
const urlToBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                // Remove data url prefix
                resolve(base64.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Error fetching image from URL", e);
        return "";
    }
};

export const analyzeLearningMaterials = async (
  materials: LearningMaterial[], 
  prompt: string, 
  history: Message[]
): Promise<string> => {
  try {
    const ai = getAiClient();
    
    const parts: any[] = [];
    
    // Add materials to the request
    for (const m of materials) {
      
      if (m.type === 'image' || m.type === 'audio' || m.type === 'video') {
        let base64Data = "";

        // Case 1: Base64 data (Local)
        if (m.content.includes('base64,')) {
            base64Data = m.content.split('base64,')[1];
        } 
        // Case 2: URL (Firebase Storage / Web)
        else if (m.content.startsWith('http')) {
            // For images, we try to fetch and convert to base64 so Gemini can see it
            if (m.type === 'image') {
                base64Data = await urlToBase64(m.content);
            } else {
                // For Audio/Video URLs, we might pass the URL as text context if model supports it or just skip
                // Currently passing as text context saying "Here is a video link: ..."
                parts.push({
                    text: `[Attached Media URL: ${m.name}](${m.content})\n`
                });
                continue;
            }
        } else {
            // Raw base64 without prefix
            base64Data = m.content;
        }

        if (base64Data) {
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType: m.mimeType || (m.type === 'image' ? 'image/jpeg' : m.type === 'audio' ? 'audio/mp3' : 'video/mp4')
              }
            });
        }
      } else {
        parts.push({
          text: `Reference Document (${m.name}):\n${m.content}\n---\n`
        });
      }
    }

    // Add the user prompt
    parts.push({ text: prompt });

    // Optimize: Simple history injection for context, limited to last 10 messages
    if (history.length > 0) {
      const historyText = history
        .filter(h => !h.isLoading)
        .slice(-10)
        .map(h => `${h.role === 'user' ? 'User' : 'Model'}: ${h.text}`)
        .join('\n');
      parts.unshift({ text: `Previous conversation:\n${historyText}\n---\n` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\nענה בהתבסס על המסמכים, התמונות, והסרטונים שהמשתמש סיפק.",
      }
    });

    return response.text || "לא הצלחתי לעבד את הבקשה.";
  } catch (error) {
    console.error("Error analyzing learning materials:", error);
    return "אירעה שגיאה בעיבוד חומרי הלימוד.";
  }
};

export const generateQuizQuestion = async (topicPrompt: string): Promise<QuizQuestion> => {
  try {
    const ai = getAiClient();
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: topicPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + "\nצור שאלת ידע אחת בסגנון אמריקאי עם 4 תשובות אפשריות. פלט בפורמט JSON בלבד.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
          },
          required: ["question", "options", "correctAnswerIndex", "explanation"],
        },
      }
    });

    if (response.text) {
      // Ensure clean JSON by removing any Markdown code blocks if present
      let cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText) as QuizQuestion;
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Error generating quiz:", error);
    return {
      question: "שגיאה בטעינת השאלה. נסה שוב מאוחר יותר.",
      options: ["...", "...", "...", "..."],
      correctAnswerIndex: 0,
      explanation: "ארעה שגיאה בתקשורת."
    };
  }
};
