import { getServerEnv, requireServerEnv } from "./server-env";

export type VisionProvider = {
  name: "dashscope" | "moonshot" | "volcengine-ark";
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function getPrimaryVisionProvider(): VisionProvider {
  const kimiKey = getServerEnv("MOONSHOT_API_KEY");
  if (kimiKey) {
    return {
      name: "moonshot",
      apiKey: kimiKey,
      baseUrl: "https://api.moonshot.cn/v1",
      model: "kimi-k3.1-pro",
    };
  }

  return {
    name: "dashscope",
    apiKey: requireServerEnv("DASHSCOPE_API_KEY"),
    baseUrl: (getServerEnv("DASHSCOPE_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, ""),
    model: getServerEnv("DASHSCOPE_VISION_MODEL") || "qwen3-vl-flash",
  };
}

export function visionChatOptions(provider: VisionProvider, temperature: number, maxTokens: number) {
  if (provider.name === "moonshot") {
    // Kimi counts reasoning and answer tokens against the same limit.
    return { model: provider.model, reasoning_effort: "low", max_completion_tokens: maxTokens + 512 };
  }

  return {
    model: provider.model,
    temperature,
    max_tokens: maxTokens,
    ...(provider.name === "dashscope" ? { enable_thinking: false } : {}),
  };
}
