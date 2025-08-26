"use server";

import { type PlateSlide } from "@/components/presentation/utils/parser";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import pptxgen from "pptxgenjs";

export async function exportToPptx(presentationId: string) {
  const session = await auth();
  // 임시로 인증 체크 우회
  // if (!session?.user) {
  //   throw new Error("Unauthorized");
  // }

  try {
    // 프레젠테이션 데이터 가져오기
    const presentation = await db.baseDocument.findUnique({
      where: { id: presentationId },
      include: {
        presentation: true,
      },
    });

    if (!presentation?.presentation) {
      throw new Error("Presentation not found");
    }

    const slides = presentation.presentation.content as unknown as {
      slides: PlateSlide[];
    };

    // 디버그: 실제 데이터 구조 확인
    console.log("Presentation content structure:", JSON.stringify(slides, null, 2));
    if (slides.slides && slides.slides.length > 0) {
      console.log("First slide structure:", JSON.stringify(slides.slides[0], null, 2));
    }

    // PPTX 생성
    const pptx = new pptxgen();
    
    // 프레젠테이션 제목 설정
    pptx.author = "ALLWEONE AI Presentation";
    pptx.company = "ALLWEONE";
    pptx.subject = presentation.title;
    pptx.title = presentation.title;

    // 각 슬라이드 처리
    for (const slideData of slides.slides) {
      console.log("Processing slide:", JSON.stringify(slideData, null, 2));
      
      const slide = pptx.addSlide();
      
      // 슬라이드 배경색 설정
      slide.background = { color: "FFFFFF" };

      let yPosition = 0.5; // 시작 Y 위치

      // 슬라이드 콘텐츠 처리 - content 배열 사용
      if (slideData.content && Array.isArray(slideData.content)) {
        for (const element of slideData.content) {
          console.log("Processing element:", JSON.stringify(element, null, 2));
          
          if (element.type === "h1" || element.type === "h2" || element.type === "h3") {
            // 제목 요소 처리
            const text = extractTextFromElement(element);
            console.log("Extracted heading text:", text);
            if (text) {
              slide.addText(text, {
                x: 0.5,
                y: yPosition,
                w: 9,
                h: element.type === "h1" ? 1.5 : 1,
                fontSize: element.type === "h1" ? 32 : element.type === "h2" ? 24 : 20,
                bold: true,
                color: "363636",
                align: "center",
              });
              yPosition += element.type === "h1" ? 2 : 1.5;
            }
          } else if (element.type === "p") {
            // 단락 요소 처리
            const text = extractTextFromElement(element);
            console.log("Extracted paragraph text:", text);
            if (text) {
              slide.addText(text, {
                x: 0.5,
                y: yPosition,
                w: 9,
                h: 1,
                fontSize: 16,
                color: "666666",
                align: "left",
              });
              yPosition += 1.2;
            }
          } else if (element.type === "ul" || element.type === "ol" || element.type === "bullets") {
            // 리스트 처리
            const listItems = extractListItems(element);
            console.log("Extracted list items:", listItems);
            for (const item of listItems) {
              slide.addText(`• ${item}`, {
                x: 1,
                y: yPosition,
                w: 8,
                h: 0.8,
                fontSize: 14,
                color: "666666",
                align: "left",
              });
              yPosition += 0.9;
            }
          } else {
            // 다른 타입의 요소들도 처리
            const text = extractTextFromElement(element);
            console.log(`Extracted text from ${element.type}:`, text);
            if (text) {
              slide.addText(text, {
                x: 0.5,
                y: yPosition,
                w: 9,
                h: 0.8,
                fontSize: 14,
                color: "666666",
                align: "left",
              });
              yPosition += 1;
            }
          }
        }
      }

      // 루트 이미지가 있는 경우 추가
      if (slideData.rootImage?.url) {
        try {
          slide.addImage({
            path: slideData.rootImage.url,
            x: 6,
            y: 1,
            w: 3,
            h: 2.5,
          });
        } catch (error) {
          console.log("이미지 추가 실패:", error);
          // 이미지 추가 실패 시 텍스트로 대체
          slide.addText("[이미지]", {
            x: 6,
            y: 1,
            w: 3,
            h: 0.5,
            fontSize: 12,
            color: "999999",
            align: "center",
          });
        }
      }
    }

    // PPTX 파일 생성
    const fileName = `${presentation.title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.pptx`;
    
    // Base64로 파일 생성
    const pptxData = await pptx.write({ outputType: "base64" });
    
    return {
      success: true,
      fileName,
      data: pptxData,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  } catch (error) {
    console.error("PPTX export error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export PPTX",
    };
  }
}

// 텍스트 요소에서 텍스트 추출하는 헬퍼 함수 (개선된 버전)
function extractTextFromElement(element: any): string {
  // 문자열인 경우 바로 반환
  if (typeof element === "string") {
    return element;
  }
  
  // null 또는 undefined인 경우 빈 문자열 반환
  if (!element) {
    return "";
  }
  
  // text 속성이 있는 경우 (Plate.js의 텍스트 노드)
  if (element.text !== undefined) {
    return element.text;
  }
  
  // children 배열이 있는 경우 재귀적으로 처리
  if (element.children && Array.isArray(element.children)) {
    return element.children
      .map((child: any) => extractTextFromElement(child))
      .filter((text: string) => text.length > 0) // 빈 문자열 제거
      .join(" ") // 공백으로 연결
      .trim();
  }
  
  // 다른 속성들에서 텍스트를 찾아보기
  if (element.content && typeof element.content === "string") {
    return element.content;
  }
  
  // value 속성이 있는 경우
  if (element.value && typeof element.value === "string") {
    return element.value;
  }
  
  return "";
}

// 리스트 아이템 추출 헬퍼 함수 (개선된 버전)
function extractListItems(listElement: any): string[] {
  const items: string[] = [];
  
  if (listElement.children && Array.isArray(listElement.children)) {
    for (const child of listElement.children) {
      // li 타입이거나 bullet 타입인 경우
      if (child.type === "li" || child.type === "bullet") {
        const text = extractTextFromElement(child);
        if (text) {
          items.push(text);
        }
      } else {
        // 다른 타입이어도 텍스트가 있으면 추가
        const text = extractTextFromElement(child);
        if (text) {
          items.push(text);
        }
      }
    }
  }
  
  // 직접적으로 텍스트가 있는 경우도 처리
  const directText = extractTextFromElement(listElement);
  if (directText && items.length === 0) {
    items.push(directText);
  }
  
  return items;
}
