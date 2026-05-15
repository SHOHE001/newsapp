import { generateText } from "@/lib/ai/providers";

export async function translateBody(bodyText: string): Promise<string> {
  const prompt = `以下の英語テキストを自然な日本語に翻訳してください。原文の意味・ニュアンスを忠実に保ちながら、読みやすい日本語にしてください。翻訳文のみを返し、説明や前置きは不要です。

${bodyText}`;

  return generateText(prompt);
}
