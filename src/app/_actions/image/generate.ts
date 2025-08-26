"use server";

import { env } from "@/env";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import OpenAI from "openai";
import Together from "together-ai";

const together = new Together({ apiKey: env.TOGETHER_AI_API_KEY });
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type ImageModelList =
  | "dall-e-3"
  | "dall-e-2"
  | "black-forest-labs/FLUX1.1-pro"
  | "black-forest-labs/FLUX.1-schnell"
  | "black-forest-labs/FLUX.1-schnell-Free"
  | "black-forest-labs/FLUX.1-pro"
  | "black-forest-labs/FLUX.1-dev";

export async function generateImageAction(
  prompt: string,
  model: ImageModelList = "dall-e-3"
) {
  // Get the current session
  const session = await auth();

  // 임시로 인증 체크 우회 - 더미 사용자 사용
  let userId = session?.user?.id;
  if (!userId) {
    userId = "dummy-user-id";
    
    // 더미 사용자가 데이터베이스에 없다면 생성
    const existingUser = await db.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      await db.user.create({
        data: {
          id: userId,
          name: "Demo User", 
          email: "demo@example.com",
          role: "USER",
          hasAccess: true,
        }
      });
    }
  }

  try {
    console.log(`Generating image with model: ${model}`);

    let imageUrl: string;

    // 모델에 따라 다른 API 사용
    if (model.startsWith("dall-e")) {
      // OpenAI DALL-E 사용
      const response = await openai.images.generate({
        model: model as "dall-e-3" | "dall-e-2",
        prompt: prompt,
        size: model === "dall-e-3" ? "1024x1024" : "1024x1024",
        quality: model === "dall-e-3" ? "standard" : undefined,
        n: 1,
      });

      imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error("Failed to generate image with DALL-E");
      }
    } else {
      // Together AI FLUX 모델 사용
      const response = (await together.images.create({
        model: model,
        prompt: prompt,
        width: 1024,
        height: 768,
        steps: model.includes("schnell") ? 4 : 28, // Fewer steps for schnell models
        n: 1,
      })) as unknown as {
        id: string;
        model: string;
        object: string;
        data: {
          url: string;
        }[];
      };

      imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error("Failed to generate image with Together AI");
      }
    }

    console.log(`Generated image URL: ${imageUrl}`);

    // 임시로 UploadThing 업로드 우회 - 원본 URL 직접 사용
    // TODO: 실제 프로덕션에서는 UploadThing 토큰 설정 후 업로드 사용
    console.log(`Using direct image URL: ${imageUrl}`);

    // Store in database with the direct URL
    const generatedImage = await db.generatedImage.create({
      data: {
        url: imageUrl, // 직접 생성된 이미지 URL 사용 (DALL-E나 Together AI URL)
        prompt: prompt,
        userId: userId, // Use the determined userId (either from session or dummy)
      },
    });

    return {
      success: true,
      image: generatedImage,
    };
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}
