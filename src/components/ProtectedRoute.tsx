import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import config from '../resources/config/config';
import {
  FINANCIAL_LINK_ROUTE,
  normalizeFinancialLinkStatus,
} from '../services/onboarding/flow';
import { useAuthSession } from '../auth/AuthSessionProvider';
import { buildLoginRedirectPath } from '../auth/routePolicy';
import { fetchResolvedOnboardingProgress } from '../services/onboarding/progress';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const BOOT_TIMEOUT_MS = 8000;

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, status } = useAuthSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const bootTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authCheckRequestIdRef = useRef(0);

  // Boot timeout safety net — if isLoading stays true for >8 seconds
  // (e.g., auth status stuck at 'booting'), redirect to login instead
  // of showing an infinite spinner. With the AuthSessionProvider fix
  // (instant boot from localStorage), this should rarely trigger.
  useEffect(() => {
    if (isLoading) {
      const capturedRequestId = authCheckRequestIdRef.current;
      bootTimeoutRef.current = setTimeout(() => {
        if (authCheckRequestIdRef.current !== capturedRequestId) return;
        console.warn(
          '[ProtectedRoute] Boot timeout reached (8s). Redirecting to login.'
        );
        setIsLoading(false);
        navigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash),
          { replace: true }
        );
      }, BOOT_TIMEOUT_MS);
    } else if (bootTimeoutRef.current) {
      clearTimeout(bootTimeoutRef.current);
      bootTimeoutRef.current = null;
    }

    return () => {
      if (bootTimeoutRef.current) {
        clearTimeout(bootTimeoutRef.current);
        bootTimeoutRef.current = null;
      }
    };
  }, [isLoading, location.hash, location.pathname, location.search, navigate]);

  const checkAuthAndOnboarding = async (requestId: number) => {
    const isCurrentRequest = () => authCheckRequestIdRef.current === requestId;
    const guardedNavigate = (to: string) => {
      if (!isCurrentRequest()) return;
      navigate(to, { replace: true });
    };
    let shouldSettleLoading = true;
    try {
      if (status === 'booting') {
        if (isCurrentRequest()) {
          setIsLoading(true);
        }
        shouldSettleLoading = false;
        return;
      }

      if (!config.supabaseClient) {
        guardedNavigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash)
        );
        return;
      }

      const user = session?.user;
      if (!user) {
        guardedNavigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash)
        );
        return;
      }

      const onboardingData = await fetchResolvedOnboardingProgress(
        config.supabaseClient,
        user.id
      );
      if (!isCurrentRequest()) return;

      const isOnOnboardingPage = location.pathname.startsWith('/onboarding/');
      const isOnFinancialLinkPage = location.pathname === FINANCIAL_LINK_ROUTE;
      const isInvestorProfileAlias = location.pathname === '/investor-profile';
      const financialLinkStatus = normalizeFinancialLinkStatus(
        onboardingData?.financial_link_status
      );

      if (
  !onboardingData ||
  (!onboardingData.is_completed && financialLinkStatus === 'pending')
) {
        if (
          !isOnOnboardingPage &&
          !(isInvestorProfileAlias && financialLinkStatus !== 'pending')
        ) {
          guardedNavigate(FINANCIAL_LINK_ROUTE);
          return;
        }

        if (!isOnFinancialLinkPage && financialLinkStatus === 'pending') {
          guardedNavigate(FINANCIAL_LINK_ROUTE);
          return;
        }
      }

      console.log('[ProtectedRoute] Authorization check passed');
      if (isCurrentRequest()) {
        setIsAuthorized(true);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      guardedNavigate(
        buildLoginRedirectPath(location.pathname, location.search, location.hash)
      );
    } finally {
      if (shouldSettleLoading && isCurrentRequest()) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const requestId = ++authCheckRequestIdRef.current;
    if (status !== 'authenticated') {
      setIsAuthorized(false);
    }
    checkAuthAndOnboarding(requestId);
    return () => {
      if (authCheckRequestIdRef.current === requestId) {
        authCheckRequestIdRef.current += 1;
      }
    };
  }, [location.hash, location.pathname, location.search, navigate, session?.user?.id, status]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
