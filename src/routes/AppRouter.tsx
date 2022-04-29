import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from '../layouts/AppLayout';
import { Home } from '../pages/Home';

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Home />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
