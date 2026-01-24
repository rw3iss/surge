import { Component, createResource, Show } from 'solid-js';
import { Title } from '@solidjs/meta';
import { api } from '../../services/api';

const AdminDashboard: Component = () => {
  const [stats] = createResource(async () => {
    const [messages, campaigns, users] = await Promise.all([
      api.get('/messages?limit=1'),
      api.get('/campaigns/donations/summary'),
      api.get('/users?limit=1'),
    ]);
    return {
      unreadMessages: (messages as any)?.meta?.unreadCount || 0,
      totalDonations: (campaigns as any)?.data?.totalAllTime || 0,
    };
  });

  return (
    <div class="admin-dashboard">
      <Title>Admin Dashboard - Surge Media</Title>
      <h1>Dashboard</h1>
      <div class="admin-dashboard__stats">
        <div class="stat-card">
          <h3>Unread Messages</h3>
          <p>{stats()?.unreadMessages || 0}</p>
        </div>
        <div class="stat-card">
          <h3>Total Donations</h3>
          <p>${((stats()?.totalDonations || 0) / 100).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
