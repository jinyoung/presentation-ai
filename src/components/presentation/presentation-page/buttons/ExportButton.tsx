"use client";
import { exportToPptx } from "@/app/_actions/presentation/exportToPptx";
import { Button } from "@/components/ui/button";
import { usePresentationState } from "@/states/presentation-state";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const { currentPresentationId } = usePresentationState();

  const handleExport = async () => {
    if (!currentPresentationId) {
      toast.error("No presentation to export");
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportToPptx(currentPresentationId);
      
      if (result.success && result.data) {
        // Base64 데이터를 Blob으로 변환
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.mimeType });

        // 파일 다운로드
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("PPTX exported successfully!");
      } else {
        toast.error(result.error || "Failed to export PPTX");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export presentation");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground"
      onClick={handleExport}
      disabled={isExporting || !currentPresentationId}
    >
      {isExporting ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-1 h-4 w-4" />
      )}
      {isExporting ? "Exporting..." : "Export"}
    </Button>
  );
}
