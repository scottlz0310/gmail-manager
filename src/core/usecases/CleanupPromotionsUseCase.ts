import { DeleteOldMailsUseCase } from "./DeleteOldMailsUseCase";
import type { MailService } from "../services/MailService";
import type { MessageRepository } from "../repositories/MessageRepository";

export class CleanupPromotionsUseCase {
  private readonly deleteUseCase: DeleteOldMailsUseCase;

  constructor(mailService: MailService, messageRepository: MessageRepository) {
    this.deleteUseCase = new DeleteOldMailsUseCase(mailService, messageRepository);
  }

  async execute(olderThanDays = 90): Promise<{ deleted: number; failed: number }> {
    return this.deleteUseCase.execute({
      category: "promotions",
      olderThanDays,
    });
  }
}
