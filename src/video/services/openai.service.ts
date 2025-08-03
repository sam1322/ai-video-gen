import { GoogleGenAI, Type } from '@google/genai';
import { InferenceClient } from '@huggingface/inference';
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class OpenAIService {
  private hf: InferenceClient;
  private ai: GoogleGenAI;

  // constructor(apiKey?: string) {
  constructor() {
    // Initialize the Hugging Face client with your API token
    // It's best to use an environment variable
    this.hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  async generateScriptByHuggingFace(query: string): Promise<string> {
    try {
      // Use the hf.chatCompletion method, which is similar to OpenAI's
      const completion = await this.hf.chatCompletion({
        // A popular, high-performing free model
        // model: "mistralai/Mistral-7B-Instruct-v0.2", // wasn't that great
        // model:"zai-org/GLM-4.5", // wasn't that great
        // model:"Qwen/Qwen3-Coder-480B-A35B-Instruct", // it was ok and pretty fast giving response in 7 seconds 
        // model: "moonshotai/Kimi-K2-Instruct", // same it gives response around  7 seconds
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        messages: [
          {
            role: "system",
            content: `You are a video script writer. Your task is to return a JSON object with two keys: "narration" and "scenes". Respond only with valid JSON. Do not include any introductory or concluding remarks. 
      The "narration" key should contain the full script text for the voiceover.
      The "scenes" key should be an array of objects, where each object has a "visual_prompt" describing a cinematic, visually engaging scene that corresponds to a part of the narration.
      Example: { "narration": "...", "scenes": [{ "visual_prompt": "A close-up of coffee beans" }] }`
          },
          {
            role: "user",
            content: `Create a 30-second video script about: ${query}`
          }
        ],
        // Note: Hugging Face uses 'max_new_tokens'
        parameters: {
          max_new_tokens: 400,
          temperature: 0.7,
        }
      });

      console.log('result', completion)

      // The response structure is very similar to OpenAI's
      return completion.choices[0]?.message?.content || this.getDefaultScript();

    } catch (error) {
      throw new BadRequestException('Hugging Face API error:', error);
      // Return the same fallback script on error
      return this.getDefaultScript();
    }
  }
  async generateScriptByGoogle(query: string): Promise<string> {
    try {

      const systemPrompt = `You are a video script writer. Your task is to return a JSON object with two keys: "narration" and "scenes". Respond only with valid JSON. Do not include any introductory or concluding remarks. 
      The "narration" key should contain the full script text for the voiceover.
      The "scenes" key should be an array of objects, where each object has a "visual_prompt" describing a cinematic, visually engaging scene that corresponds to a part of the narration.
      Example: { "narration": "...", "scenes": [{ "visual_prompt": "A close-up of coffee beans" }] }`

      const question1 = `You are a video script writer. The "narration" key should contain the full script text for the voiceover.
      The "visual_prompt" key should be an array of strings, where each string should be describing a cinematic, visually engaging scene that corresponds to a part of the narration.
      Create a 30-second video script about: ${query}`

      const question = `Create a 30-second video script about: ${query}`

      // const response1 = await this.ai.models.generateContent({
      //   model: "gemini-2.5-flash",
      //   contents: question,
      //   config: {
      //     systemInstruction: systemPrompt,
      //   },
      // });
      // console.log("result", response1);

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents:
          question,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              narration: {
                type: Type.STRING,
              },
              visual_prompt: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
              },
            },
            propertyOrdering: ["narration", "visual_prompt"],
          },
        },
      });

      // The response structure is very similar to OpenAI's
      return response.text || this.getDefaultScript();

    } catch (error) {
      throw new BadRequestException('Gemini API error:', error);
    }
  }

  private getDefaultScript(): string {
    return "Welcome to our video about making the perfect cup of coffee. First, we start with fresh coffee beans. Next, we grind them to the perfect consistency. Finally, we brew and enjoy our delicious coffee.";
  }
}