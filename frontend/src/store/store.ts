/**
 * Redux Store Configuration
 * 
 * Central state management using Redux Toolkit
 */

import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import threatModelReducer from './threatModel.slice';
import analysisReducer from './analysis.slice';

export const store = configureStore({
  reducer: {
    threatModel: threatModelReducer,
    analysis: analysisReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['analysis/uploadTerraform/pending'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.files'],
        // Ignore these paths in the state
        ignoredPaths: ['analysis.uploadedFiles'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
