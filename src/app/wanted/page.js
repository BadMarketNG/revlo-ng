import WantedForm from './WantedForm';
import './wanted.css';

export const metadata = {
  title: 'Post what you need — Revlo.ng',
  description: 'Ask for an item, a place to rent, or a service in Nigeria. People with an answer can contact you through Revlo.',
};

export default function WantedPage() {
  return <WantedForm />;
}
