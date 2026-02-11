/**
 * FileUpload Component
 * 
 * Drag-and-drop file upload for Terraform files
 */

import React, { useCallback } from 'react';
import { Group, Text, rem } from '@mantine/core';
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { IconUpload, IconFile, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface FileUploadProps {
  onUpload: (files: FileList) => void;
  loading?: boolean;
  accept?: string[];
  maxSize?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  loading = false,
  accept = ['.tf', '.tfvars', '.hcl', 'text/plain'],
  maxSize = 5 * 1024 * 1024, // 5MB default
}) => {
  const handleDrop = useCallback((files: FileWithPath[]) => {
    if (files.length === 0) return;
    
    // Create FileList-like object
    const fileList = {
      length: files.length,
      item: (index: number) => files[index],
      [Symbol.iterator]: function* () {
        for (let i = 0; i < files.length; i++) {
          yield files[i];
        }
      },
    } as FileList;
    
    // Add array indexing
    files.forEach((file, index) => {
      (fileList as any)[index] = file;
    });
    
    onUpload(fileList);
    
    notifications.show({
      title: 'Files uploaded',
      message: `${files.length} file(s) uploaded successfully`,
      color: 'green',
    });
  }, [onUpload]);
  
  const handleReject = useCallback(() => {
    notifications.show({
      title: 'Upload failed',
      message: 'Files rejected. Check file type and size.',
      color: 'red',
    });
  }, []);
  
  return (
    <Dropzone
      onDrop={handleDrop}
      onReject={handleReject}
      maxSize={maxSize}
      accept={accept}
      loading={loading}
      multiple
    >
      <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
        <Dropzone.Accept>
          <IconUpload
            style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
            stroke={1.5}
          />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX
            style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
            stroke={1.5}
          />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconFile
            style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
            stroke={1.5}
          />
        </Dropzone.Idle>

        <div>
          <Text size="xl" inline>
            Drag Terraform files here or click to select
          </Text>
          <Text size="sm" c="dimmed" inline mt={7}>
            Upload .tf, .tfvars, or .hcl files (max {maxSize / 1024 / 1024}MB each)
          </Text>
        </div>
      </Group>
    </Dropzone>
  );
};
