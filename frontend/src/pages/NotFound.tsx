import { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';

const NotFoundPage: Component = () => (
  <div class="not-found container" style={{ "text-align": "center", "padding": "4rem 1rem" }}>
    <Title>Page Not Found - Surge Media</Title>
    <h1>404</h1>
    <p>Page not found</p>
    <A href="/">Go Home</A>
  </div>
);

export default NotFoundPage;
