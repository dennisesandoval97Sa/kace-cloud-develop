import { useQuery } from '@tanstack/react-query';
import { fetchBoardsById } from '../services/boards.service';

export const useBoardsItem = (id) => {
  return useQuery(['boards', id], () => fetchBoardsById(id));
};
