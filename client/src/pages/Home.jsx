
import { Link } from 'react-router-dom';
function Home() {

return (

<div style={{ fontFamily: 'Arial, sans-serif' }}>

{/* Hero section */}

<section

style={{

background: '#1A90F8',

color: '#fff',

padding: '80px 20px',

textAlign: 'center',

}}

>

<h1 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>

You're not alone. Help is here.

</h1>

<p style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 32px' }}>

MindEase connects you with trained volunteers and mental health

professionals, anonymously and confidentially, whenever you need it.

</p>

<Link

to="/request-support"

style={{

background: '#fff',

color: '#1A90F8',

padding: '14px 32px',

borderRadius: '8px',

fontWeight: 'bold',

textDecoration: 'none',

display: 'inline-block',

}}

>

Get Support Now

</Link>

</section>
  {/* How it works */}  
  <section style={{ padding: '60px 20px', textAlign: 'center' }}>  
    <h2 style={{ marginBottom: '40px' }}>How MindEase Works</h2>  
    <div  
      style={{  
        display: 'flex',  
        flexWrap: 'wrap',  
        justifyContent: 'center',  
        gap: '32px',  
      }}  
    >  
      <div style={{ maxWidth: '260px' }}>  
        <h3>1. Reach Out</h3>  
        <p>Submit a crisis request anonymously, no judgment, no pressure.</p>  
      </div>  
      <div style={{ maxWidth: '260px' }}>  
        <h3>2. Connect</h3>  
        <p>A trained volunteer responds through secure, encrypted chat.</p>  
      </div>  
      <div style={{ maxWidth: '260px' }}>  
        <h3>3. Get Support</h3>  
        <p>Escalate to a licensed psychologist or NGO referral if needed.</p>  
      </div>  
    </div>  
  </section>

  {/* Quick resources */}  
  <section  
    style={{  
      background: '#F8F9FA',  
      padding: '60px 20px',  
      textAlign: 'center',  
    }}  
  >  
    <h2 style={{ marginBottom: '16px' }}>In Immediate Crisis?</h2>  
    <p style={{ marginBottom: '24px' }}>  
      Access verified emergency helplines and resources right away.  
    </p>  
    <Link  
      to="/resources"  
      style={{  
        color: '#1A90F8',  
        fontWeight: 'bold',  
        textDecoration: 'underline',  
      }}  
    >  
      View Resource Hub →  
    </Link>  
  </section>  
</div>  
);

}
export default Home;  