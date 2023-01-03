import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from '../layouts/AppLayout';
import { Home } from '../pages/Home';

export const AppRouter = () => (
  <Routes>
    <Route path="/" element={<AppLayout />}>
      <Route index element={<Home />} />
    </Route>
  </Routes>
);
