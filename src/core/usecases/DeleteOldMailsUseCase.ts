import type { MailQuery, MailService } from "../services/MailService";
import type { MessageRepository } from "../repositories/MessageRepository";

const CHUNK_SIZE = 500;
const CHUNK_INTERVAL_MS = 200;

export class DeleteOldMailsUseCase {
  constructor(
    private readonly mailService: MailService,
    private readonly messageRepository: MessageRepository
  ) {}

  async execute(query: MailQuery): Promise<{ deleted: number; failed: number }> {
    const ids = await this.mailService.list(query);

    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);

      try {
        await this.mailService.batchDelete(chunk);
        await this.messageRepository.upsertMany(
          chunk.map((id) => ({ id, status: "deleted" as const, action: "batchDelete" }))
        );
        deleted += chunk.length;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.messageRepository.upsertMany(
          chunk.map((id) => ({
            id,
            status: "failed" as const,
            action: "batchDelete",
            errorMessage,
          }))
        );
        failed += chunk.length;
      }

      if (i + CHUNK_SIZE < ids.length) {
        await new Promise((resolve) => setTimeout(resolve, CHUNK_INTERVAL_MS));
      }
    }

    return { deleted, failed };
  }
}
