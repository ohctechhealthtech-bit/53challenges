import { Link } from 'react-router-dom';
import { useChallengeDomainMap, challengeTarget } from '@/lib/challengeDomains';

/**
 * Opens a challenge wherever it actually lives.
 *
 * A challenge with its own domain gets a plain <a> so the browser leaves this
 * host — a react-router <Link> would stay put and render the challenge at
 * /challenges/<id> on the main site instead. Everything else routes in-app as
 * before, including while the domain map is still loading.
 */
export default function ChallengeLink({ challengeId, className, children, ...rest }) {
  const map = useChallengeDomainMap();
  const target = challengeTarget(challengeId, map);

  if (target.href) {
    return (
      <a href={target.href} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link to={target.to} className={className} {...rest}>
      {children}
    </Link>
  );
}
