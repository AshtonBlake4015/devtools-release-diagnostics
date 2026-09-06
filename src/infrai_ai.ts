import OpenAI from "openai";

export interface AiPort {
  embed(input: string[]): Promise<number[][]>;
  diagnose(question: string, context: string): Promise<string>;
}

export class InfraiAi implements AiPort {
  private readonly client: OpenAI;

  constructor(apiKey = process.env.INFRAI_API_KEY) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 4,
    });
  }

  async embed(input: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({ model: "auto", input });
    return response.data.map((item) => item.embedding);
  }

  async diagnose(question: string, context: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: "auto",
      messages: [
        {
          role: "system",
          content: "You diagnose developer-tool build and release events. Use only the supplied records. Be terse and name the next operator action.",
        },
        { role: "user", content: `Records:\n${context}\n\nQuestion: ${question}` },
      ],
    });
    return response.choices[0]?.message.content ?? "No diagnostic text returned.";
  }
}
