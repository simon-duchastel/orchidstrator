import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { AgentType } from "../agent-framework/session-repository.js";
import { ModelRepository, createModelRepository, type Model } from "./model-repository.js";

// Mock the fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const TEST_MODELS_PATH = "/test/.orchid/models.json";

describe("ModelRepository", () => {
  let repository: ModelRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create with default path when no options provided", () => {
      repository = createModelRepository();
      expect(repository.getAllModels()).toEqual([]);
    });

    it("should use custom path when provided", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === "/custom/models.json";
      });
      vi.mocked(readFileSync).mockReturnValue('{"models": [{"provider": "test", "modelId": "model"}], "agentModels": {}}');

      repository = createModelRepository({ modelsJsonPath: "/custom/models.json" });
      
      const models = repository.getAllModels();
      expect(models).toHaveLength(1);
      expect(models[0]).toEqual({ provider: "test", modelId: "model" });
    });

    it("should handle missing models.json gracefully", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      expect(repository.getAllModels()).toEqual([]);
    });

    it("should handle corrupted models.json gracefully", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json");
      
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      expect(repository.getAllModels()).toEqual([]);
    });
  });

  describe("getAllModels", () => {
    it("should return empty array when no models", () => {
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      expect(repository.getAllModels()).toEqual([]);
    });

    it("should return all models from file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {}
      }));

      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      const models = repository.getAllModels();
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({ provider: "anthropic", modelId: "claude-3" });
      expect(models[1]).toEqual({ provider: "openai", modelId: "gpt-4" });
    });
  });

  describe("addModel", () => {
    beforeEach(() => {
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
    });

    it("should add a model", () => {
      const model: Model = { provider: "anthropic", modelId: "claude-3" };
      
      repository.addModel(model);
      
      expect(repository.getAllModels()).toContainEqual(model);
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should throw if model already exists", () => {
      const model: Model = { provider: "anthropic", modelId: "claude-3" };
      repository.addModel(model);
      
      expect(() => repository.addModel(model)).toThrow("Model anthropic/claude-3 already exists");
    });

    it("should persist to file", () => {
      const model: Model = { provider: "openai", modelId: "gpt-4" };
      
      repository.addModel(model);
      
      expect(writeFileSync).toHaveBeenCalledWith(
        TEST_MODELS_PATH,
        expect.stringContaining('"models"')
      );
    });
  });

  describe("removeModel", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {}
      }));
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
    });

    it("should remove a model", () => {
      const result = repository.removeModel("anthropic", "claude-3");
      
      expect(result).toBe(true);
      expect(repository.getAllModels()).toHaveLength(1);
      expect(repository.getAllModels()[0].modelId).toBe("gpt-4");
    });

    it("should return false if model not found", () => {
      const result = repository.removeModel("unknown", "model");
      
      expect(result).toBe(false);
    });

    it("should throw if model is assigned to an agent", () => {
      // Set up a model assigned to an agent
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        models: [{ provider: "anthropic", modelId: "claude-3" }],
        agentModels: { [AgentType.IMPLEMENTOR]: { provider: "anthropic", modelId: "claude-3" } }
      }));
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      expect(() => repository.removeModel("anthropic", "claude-3"))
        .toThrow("Cannot remove model anthropic/claude-3 - assigned to implementor");
    });

    it("should persist to file after removal", () => {
      repository.removeModel("anthropic", "claude-3");
      
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe("getModelForAgent", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {
          [AgentType.IMPLEMENTOR]: { provider: "anthropic", modelId: "claude-3" },
          [AgentType.REVIEWER]: { provider: "openai", modelId: "gpt-4" }
        }
      }));
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
    });

    it("should get model for implementor", () => {
      const model = repository.getModelForAgent(AgentType.IMPLEMENTOR);
      
      expect(model).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });

    it("should get model for reviewer", () => {
      const model = repository.getModelForAgent(AgentType.REVIEWER);
      
      expect(model).toEqual({ provider: "openai", modelId: "gpt-4" });
    });

    it("should return undefined if no model set for agent", () => {
      const model = repository.getModelForAgent(AgentType.MERGER);
      
      expect(model).toBeUndefined();
    });
  });

  describe("setModelForAgent", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {}
      }));
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
    });

    it("should set model for agent", () => {
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      
      const model = repository.getModelForAgent(AgentType.IMPLEMENTOR);
      expect(model).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });

    it("should throw if model does not exist", () => {
      expect(() => repository.setModelForAgent(AgentType.IMPLEMENTOR, "unknown", "model"))
        .toThrow("Model unknown/model not found");
    });

    it("should update existing assignment", () => {
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "openai", "gpt-4");
      
      const model = repository.getModelForAgent(AgentType.IMPLEMENTOR);
      expect(model).toEqual({ provider: "openai", modelId: "gpt-4" });
    });

    it("should persist to file", () => {
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      
      expect(writeFileSync).toHaveBeenCalledWith(
        TEST_MODELS_PATH,
        expect.stringContaining('"implementor"')
      );
    });
  });

  describe("provider methods (placeholders)", () => {
    beforeEach(() => {
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
    });

    it("getAllProviders should return empty array", () => {
      expect(repository.getAllProviders()).toEqual([]);
    });

    it("addProvider should throw not implemented", () => {
      expect(() => repository.addProvider({ name: "test" }))
        .toThrow("addProvider not implemented");
    });

    it("removeProvider should throw not implemented", () => {
      expect(() => repository.removeProvider("test"))
        .toThrow("removeProvider not implemented");
    });
  });

  describe("persistence", () => {
    it("should create directory if needed when saving", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      repository.addModel({ provider: "test", modelId: "model" });
      
      expect(mkdirSync).toHaveBeenCalledWith("/test/.orchid", { recursive: true });
    });

    it("should save valid JSON", () => {
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      repository.addModel({ provider: "anthropic", modelId: "claude-3" });
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      
      const writeCall = vi.mocked(writeFileSync).mock.calls[1]; // Second call (addModel + setModelForAgent)
      const written = JSON.parse(writeCall[1] as string);
      
      expect(written.models).toContainEqual({ provider: "anthropic", modelId: "claude-3" });
      expect(written.agentModels.implementor).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });
  });

  describe("edge cases", () => {
    it("should handle models with special characters in modelId", () => {
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      const model: Model = { provider: "test", modelId: "model-v1.0-beta_test" };
      repository.addModel(model);
      
      expect(repository.getAllModels()).toContainEqual(model);
    });

    it("should handle multiple agents with same model", () => {
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      repository.addModel({ provider: "anthropic", modelId: "claude-3" });
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      repository.setModelForAgent(AgentType.REVIEWER, "anthropic", "claude-3");
      
      expect(repository.getModelForAgent(AgentType.IMPLEMENTOR)).toEqual({ provider: "anthropic", modelId: "claude-3" });
      expect(repository.getModelForAgent(AgentType.REVIEWER)).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });

    it("should allow removing model after unassigning from all agents", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        models: [{ provider: "anthropic", modelId: "claude-3" }],
        agentModels: { [AgentType.IMPLEMENTOR]: { provider: "anthropic", modelId: "claude-3" } }
      }));
      repository = createModelRepository({ modelsJsonPath: TEST_MODELS_PATH });
      
      // First clear the assignment by setting to a different model
      repository.addModel({ provider: "openai", modelId: "gpt-4" });
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "openai", "gpt-4");
      
      // Now we can remove the anthropic model
      const result = repository.removeModel("anthropic", "claude-3");
      
      expect(result).toBe(true);
    });
  });
});
