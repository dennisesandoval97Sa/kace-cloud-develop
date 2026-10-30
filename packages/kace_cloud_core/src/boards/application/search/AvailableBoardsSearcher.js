import { BoardCollectionResponse } from "@kace/core/src/boards/application/BoardCollectionResponse";

export class AvailableBoardsSearcher {
  constructor(repository) {
    this.repository = repository;
  }

  async execute({ userId, groupId }) {
    const boards = await this.repository.searchAvailableBoards({
      userId,
      groupId,
    });

    return new BoardCollectionResponse(boards, boards.length);
  }
}
