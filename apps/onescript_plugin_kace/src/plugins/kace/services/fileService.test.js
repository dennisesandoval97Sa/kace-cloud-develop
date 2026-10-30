import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { FileService } from './fileService.js';
import { storeService } from './storeService.js';

vi.mock('axios', () => ({
  default: {
    put: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./storeService.js', () => ({
  storeService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('FileService.uploadFile', () => {
  let apiPost;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    apiPost = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: { data: { uploadUrl: 'https://s3.example.test/upload' } },
      })
      .mockResolvedValueOnce({ status: 200, data: { data: {} } })
      .mockResolvedValueOnce({ status: 200, data: { data: {} } });
    service = new FileService({
      apiService: { post: apiPost },
      store: {},
    });
  });

  it('sends the selected attachment type in the case attachment payload', async () => {
    const file = new File(['image'], 'DJI_0060_Moment.jpg', {
      type: 'image/jpeg',
    });

    await service.uploadFile({
      id: 'case-123',
      contentType: 'image/jpeg',
      fileName: 'DJI_0060_Moment.jpg',
      file,
      attachmentType: 2,
    });

    expect(axios.put).toHaveBeenCalledWith(
      'https://s3.example.test/upload',
      file,
      { headers: { 'Content-Type': 'image/jpeg' } }
    );
    expect(apiPost).toHaveBeenLastCalledWith(
      '/case-attachments',
      expect.objectContaining({
        case_id: 'case-123',
        path: 'DJI_0060_Moment.jpg',
        type: 2,
      })
    );
  });

  it('honors legacy pending attachment type values during upload', async () => {
    const file = new File(['image'], 'legacy.jpg', {
      type: 'image/jpeg',
    });

    await service.uploadAttachments('case-123', [
      {
        path: 'legacy.jpg',
        description: 'image/jpeg',
        file,
        type: 2,
      },
    ]);

    expect(apiPost).toHaveBeenLastCalledWith(
      '/case-attachments',
      expect.objectContaining({
        case_id: 'case-123',
        path: 'legacy.jpg',
        type: 2,
      })
    );
  });

  it('normalizes fetched backend type into attachmentType for the UI', async () => {
    apiPost = vi.fn().mockResolvedValueOnce({
      data: {
        data: {
          items: [
            {
              id: 'attachment-1',
              case_id: 'case-123',
              path: 'DJI_0060_Moment.jpg',
              description: 'image/jpeg',
              type: 2,
            },
          ],
        },
      },
    });
    service = new FileService({
      apiService: { post: apiPost },
      store: {},
    });
    storeService.get.mockReturnValue(null);

    const attachments = await service.fetchAttachmentsByCaseId('case-123');

    expect(attachments).toEqual([
      expect.objectContaining({
        id: 'attachment-1',
        type: 2,
        attachmentType: 2,
      }),
    ]);
  });
});

describe('FileService.updateModifiedAttachmentTypes', () => {
  let apiPost;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    apiPost = vi.fn();
    service = new FileService({
      apiService: { post: apiPost },
      store: {},
    });
  });

  it('clears typeChanged flags on successful update', async () => {
    storeService.get.mockReturnValue([
      { id: 'a1', attachmentType: 2, typeChanged: true },
      { id: 'a2', attachmentType: 1 },
    ]);
    apiPost.mockResolvedValue({ status: 200 });

    await service.updateModifiedAttachmentTypes();

    expect(apiPost).toHaveBeenCalledOnce();
    expect(apiPost).toHaveBeenCalledWith('/case-attachments/a1', { type: 2 });
    expect(storeService.set).toHaveBeenCalledWith('cases.attachments', [
      { id: 'a1', attachmentType: 2 },
      { id: 'a2', attachmentType: 1 },
    ]);
  });

  it('clears typeChanged only for succeeded items on partial failure', async () => {
    storeService.get.mockReturnValue([
      { id: 'a1', attachmentType: 2, typeChanged: true },
      { id: 'a2', attachmentType: 1, typeChanged: true },
    ]);
    apiPost
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error('403 Forbidden'));

    await expect(service.updateModifiedAttachmentTypes()).rejects.toThrow(
      /1 adjunto/
    );

    expect(storeService.set).toHaveBeenCalledWith('cases.attachments', [
      { id: 'a1', attachmentType: 2 },
      { id: 'a2', attachmentType: 1, typeChanged: true },
    ]);
  });

  it('does nothing when no attachments have typeChanged', async () => {
    storeService.get.mockReturnValue([{ id: 'a1', attachmentType: 1 }]);

    await service.updateModifiedAttachmentTypes();

    expect(apiPost).not.toHaveBeenCalled();
    expect(storeService.set).not.toHaveBeenCalled();
  });
});
