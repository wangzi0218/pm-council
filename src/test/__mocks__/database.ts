/**
 * Mock database module for testing.
 * Returns empty results by default, can be customized per test.
 */

export const db = {
  init: vi.fn().mockResolvedValue(undefined),
  listWorkspaces: vi.fn().mockResolvedValue([]),
  listChats: vi.fn().mockResolvedValue([]),
  listMessages: vi.fn().mockResolvedValue([]),
  getResolvedChoices: vi.fn().mockResolvedValue([]),
  getPendingChoice: vi.fn().mockResolvedValue(null),
  getOtherChatMessages: vi.fn().mockResolvedValue([]),
  getActiveSkillsForCharacter: vi.fn().mockResolvedValue([]),
  listSkills: vi.fn().mockResolvedValue([]),
  listCharacterSkills: vi.fn().mockResolvedValue([]),
  createWorkspace: vi.fn().mockImplementation((ws) => Promise.resolve(ws)),
  createChat: vi.fn().mockImplementation((chat) => Promise.resolve(chat)),
  createMessage: vi.fn().mockImplementation((msg) => Promise.resolve(msg)),
  updateWorkspace: vi.fn().mockResolvedValue(undefined),
  updateChat: vi.fn().mockResolvedValue(undefined),
  updateChoice: vi.fn().mockResolvedValue(undefined),
  deleteWorkspace: vi.fn().mockResolvedValue(undefined),
  deleteChat: vi.fn().mockResolvedValue(undefined),
  deleteMessage: vi.fn().mockResolvedValue(undefined),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  loadAppSettings: vi.fn().mockResolvedValue({
    llm: { provider: "openai", baseUrl: "", apiKey: "", model: "gpt-4o" },
    theme: "system",
    fontSize: "medium",
  }),
  saveAppSettings: vi.fn().mockResolvedValue(undefined),
  exportWorkspace: vi.fn().mockResolvedValue("{}"),
  importWorkspace: vi.fn().mockResolvedValue("ws-id"),
  createChoice: vi.fn().mockImplementation((choice) => Promise.resolve(choice)),
  setCharacterSkill: vi.fn().mockResolvedValue(undefined),
};
