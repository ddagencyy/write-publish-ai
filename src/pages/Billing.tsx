import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const plans = [
  {
    name: 'Free',
    price: 0,
    credits: 3,
    features: ['3 articles per month', 'Basic support', 'WordPress integration']
  },
  {
    name: 'Starter',
    price: 19,
    credits: 20,
    features: ['20 articles per month', 'Priority support', 'WordPress integration', 'Keyword research']
  },
  {
    name: 'Pro',
    price: 49,
    credits: 100,
    features: ['100 articles per month', 'Premium support', 'WordPress integration', 'Advanced keyword research', 'Content scheduling']
  },
  {
    name: 'Agency',
    price: 99,
    credits: -1,
    features: ['Unlimited articles', 'Dedicated support', 'WordPress integration', 'Advanced keyword research', 'Content scheduling', 'White-label options']
  }
];

export default function Billing() {
  const [loading, setLoading] = useState<string | null>(null);
  const { subscription } = useAuth();

  const handleUpgrade = async (planName: string) => {
    if (planName === 'Free') {
      toast.info('You are already on the Free plan');
      return;
    }

    setLoading(planName);
    try {
      // This would integrate with Stripe checkout
      toast.info('Stripe integration coming soon! This will redirect to checkout.');
      // const { data, error } = await supabase.functions.invoke('create-checkout', {
      //   body: { plan: planName }
      // });
      // if (error) throw error;
      // window.open(data.url, '_blank');
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Pricing Plans
        </h1>
        <p className="text-muted-foreground mt-2">
          Choose the perfect plan for your content needs
        </p>
      </div>

      {subscription && (
        <Card className="mb-8 shadow-lg border-primary/20">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your active subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10">
              <div>
                <div className="font-bold text-xl capitalize">{subscription.plan} Plan</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {subscription.credits_remaining === -1 
                    ? 'Unlimited credits' 
                    : `${subscription.credits_remaining} / ${subscription.credits_total} credits remaining`
                  }
                </div>
              </div>
              <Zap className="h-10 w-10 text-accent" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrentPlan = subscription?.plan.toLowerCase() === plan.name.toLowerCase();
          
          return (
            <Card 
              key={plan.name} 
              className={`shadow-lg transition-all hover:shadow-xl ${
                isCurrentPlan ? 'border-primary/50 ring-2 ring-primary/20' : ''
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {isCurrentPlan && (
                    <span className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground">
                      Current
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {plan.credits === -1 ? 'Unlimited' : plan.credits} articles/month
                </div>
                
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : 'default'}
                  disabled={isCurrentPlan || loading === plan.name}
                  onClick={() => handleUpgrade(plan.name)}
                >
                  {loading === plan.name ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : (
                    plan.name === 'Free' ? 'Current Plan' : 'Upgrade'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
