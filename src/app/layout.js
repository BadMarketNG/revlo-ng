export const metadata = {
  title: 'Revlo.ng',
  description: 'Accountless, time-based publishing for Nigeria.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
