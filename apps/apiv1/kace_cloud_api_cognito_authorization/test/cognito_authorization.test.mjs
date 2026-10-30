import { CognitoCredentials } from '@kace/core/src/auth-cognito/domain/CognitoCredentials';
import PasswordEncoder from '@kace/core/src/shared/domain/crypto/PasswordEncoder';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAuthCognitoRepository } from '@kace/core/src/auth-cognito/infraestructure/KnexAuthCognitoRepository.js';
import { TestHelper } from '@kace/api-common';

const payload = {
    id_token:
        'eyJraWQiOiJ1UTdOdllzZUNKS3Nia09odHY2VVJVUnJ4S2wxMit3RXlSKzR3Mk9kUXBJPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiRWVDNEExMmZLNXVkdHJsamM0N3FadyIsInN1YiI6ImQ0Nzg1NDk4LTIwZTEtNzBiYi1kYjY4LTk5OWRiMGQ3NzBiZiIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9IRnRIZ1BydjVfa2V5Y2xvYWstZGV2Il0sImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfSEZ0SGdQcnY1IiwiY29nbml0bzp1c2VybmFtZSI6ImtleWNsb2FrLWRldl9jbzc2MjRteHMiLCJub25jZSI6Ilk4a3U4YVpCZ0RnUjFQWmRmY0RxQ3N0RlczenhKRnFVSkJncllrMW4wV2NKZkZaZ2pySjdDMkNfY2RmZXdZZ1FnS0FnbEhGNWRrbng2UDIxZ2NJSHEyV0x5UkZTQ3VrTkhxaTJmVVJMR3ctVmJYNEJqcEMxUFdxakZINEYtSW5oVDJyeExXTUJEV1RLd2dFT29PYkZDNTRnSFQ1VmNrMDRscWZUdUxBTDVxQSIsIm9yaWdpbl9qdGkiOiJhNjgzMWNmNC0yOTg0LTQ3MGYtYjQ3MS1lMTE0YmFjOTIxZmMiLCJhdWQiOiJjbGE5djQ5dGcwc2ZjdmpmYnY3c29zbGoyIiwiaWRlbnRpdGllcyI6W3siZGF0ZUNyZWF0ZWQiOiIxNzMwODE3NDA0OTE1IiwidXNlcklkIjoiY283NjI0bXhzIiwicHJvdmlkZXJOYW1lIjoia2V5Y2xvYWstZGV2IiwicHJvdmlkZXJUeXBlIjoiU0FNTCIsImlzc3VlciI6bnVsbCwicHJpbWFyeSI6InRydWUifV0sInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNzMxMDgzMzgzLCJleHAiOjE3MzEwODY5ODMsImlhdCI6MTczMTA4MzM4MywianRpIjoiZTU4NmVhM2MtY2EyMS00YjMyLTlkOGUtNzc1MDA4N2FkOGM0IiwiZW1haWwiOiJkYXZpZC5jYXN0aWxsZWpvQGtvbmVjdGEtZ3JvdXAuY29tIn0.ES9kXdh5zrfMk6rJ_IrlJb-B_zvAhpj3gjqtZyEcWr-iHa1HM0GuS-fjbfBoyWXVN5I36yiKttspIMF6iwvRiBqfqyq51BB_KohARGG_KNvgZBSeBU1COMi72dudcjxvajhDynQjnkktvvD4n2D7kJ2vZl1Gyh7zj_k9O8BJasIknZW5L-Wo4Pa_iaKeic4GIbLmARVBwI_tnFyoKM4YpxEDXZzF2Ypy4goXPTqlsrA6DVFhQTxGw1i3_sl420VuEHuYXp-C5EhIyLICzUiXe4raKG9xaoFtztePVjxIygwfnWOWzdXBYDmf7_8DpZoBPHt_9Ifk7qvOnG67v1zm3g',
    access_token:
        'eyJraWQiOiJwY0FONmd1M1JlUGhidTRFWHZBcEtJbWtIWW10VDhBNHU3ZzllNnJjWTF3PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJkNDc4NTQ5OC0yMGUxLTcwYmItZGI2OC05OTlkYjBkNzcwYmYiLCJjb2duaXRvOmdyb3VwcyI6WyJ1cy1lYXN0LTFfSEZ0SGdQcnY1X2tleWNsb2FrLWRldiJdLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV9IRnRIZ1BydjUiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJjbGE5djQ5dGcwc2ZjdmpmYnY3c29zbGoyIiwib3JpZ2luX2p0aSI6ImE2ODMxY2Y0LTI5ODQtNDcwZi1iNDcxLWUxMTRiYWM5MjFmYyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoib3BlbmlkIGVtYWlsIiwiYXV0aF90aW1lIjoxNzMxMDgzMzgzLCJleHAiOjE3MzEwODY5ODMsImlhdCI6MTczMTA4MzM4MywianRpIjoiNjg0MzU2MmQtMmJmYy00OWQ0LTk2YmYtZTBmZjYxZTFjYzcxIiwidXNlcm5hbWUiOiJrZXljbG9hay1kZXZfY283NjI0bXhzIn0.d8ZQZT-PhtXbBxyIGe9ACLj05fa8jV0XMh8-EZLcpPjgV3E0guYErit1q-ksM8mflDhTTGCZf7KHjgnBPchN-UlsJoEkFNSYHRKKgrSKdfCouIjfLCq5L_CWlRK3QvcnLUwET9efjqHL1q1lT3A86hacEBpSfelujSMMMhJ9b-3hB1vPH_DVB5XYdQLb-cCm8PWMJ4X4_bdWIZgm5AMJrHHy3AdXMvLUxL1XkHMtb2rWEpurvFsb92HNVe5Afh6PkzaWA3HW1Zkq2bMmnDtc0hSzhuKJCQ5N5_HENg83hurR5c-i_M1Teg0Kc_nnBRmZLBgza2M3oNXmYsobP_eZ-Q',
    refresh_token:
        'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.2OclF_Gu1ZiFyB53xOhwXmoI3UgTu5czTnSYACCkA1wBFQKY66xSz235R6JItH81gtTaDPfbaD2VGJ0Rl27cEHfUaOwCZlEhxh9Z9SGi7cLAQlCX3kDqYweTibGl4DpCgeFoKY_SpDDCNRcRRYqYOI9hD5J9sDxX2WQA3n_fuJ-g-XV1QpoJzzF0csU2yXSyXwyyxsxPF7bxwMCZWeI690xoNRIzlGzaibczDJxKD4Z18dNEemfx2uUIeuTmTic7tbf0Giu8YyGk1wLaB6gG9snT3W1Aiv10zbc6JLO4aaenSt-wKL5DIaadN-0bglfC_14CnA95s7F82poYr74Yhw.C7tamgA7rJy866hU.DdV5SLVkGTnQfF1L5QS4Zd8tMaKmmYEXztvlQf90spMyAIOc2Q58NNltvPwmGYu2QNW6IVGPj_cdwD_3BbIVlYdzlUf0SSqhKxT7ZS5VAF4oNx-Nu314C44zY_IZCshNSHvxM0MZjY9tQUtg0aKQN1B14Fw52i7iKsn8XqmRqmtcVdzzZGe8Thom6PNaliAxCEwh6FnPuvMmyMThu3aMbFtoTEN_f_2vAmdt4uXbDW2wAofPUBnKREcThYd6H42ldnUpk0ElAUguEcbnaUeDjWowkuzII-r2Kory73pgfAt0XFU9NWSSWEppTJcybhxRn20UhwIPLtP093q5Eg-IKtYH0TepYhhDy-xlnVd7cUKklMqfDHLYzx25tEQTdrP458BYu26CQGmT9xzay5ZEb7K_jYIjOVKOTlHPdxSIFOB9r1noSs1VYs_QlywReNqWMRs71ab29jJ_KZXMNyiwKq9tj90MO13Hl9z4V9TgEjBrmMUXQaNwfRblMp85kBENuS0RsPAPRKlxpwx8L209kRloXqIixyYnmOKGqyugAKjMNM6TI3f6FF5OSrxqiDAclcYEW-1Q1zo7Vl3ECDNnJFQ1Xk1SrcQZkvgJVNv4c8U8W1NKLAcnUdOfrL7QmWEHGolMQgfkqYEmWadOJdJvp7tGqAvk3VhFDMPE6YNWmrETW_Vd8EyC4INAQ5-oHCatowp93bmorgoMrsDGisg2-TkkodAYRvZgw4lwPJ_RwHg3NHLIEm-cnUiJwQW2_LK6tMoTRijJmWp-c3ulYTDwSF7pnN_VNf58_SWfS_iV95AF6imTX0RJMlsYBDFxJ2YpRmA5Papj7e6iwS2endiVuFXcCXYcT-sgeBXbd9ohWT63QZJGu1_Asouv9VjBbQfvqbkctbE9ffWqnJeNy1JGzUxLpFPcN6XMSLPO1kBRmi3E_ZLYitbsf0Ve7HWiuPU3GlPaNq7bBMuOXfsUkcB_QYBwUOz6Ljz5v2N0doKoI9Hm1e7OD23XSqm5z9hu9xMzdWkDd3IQ7QKUaipj_0vwj7KxQ8MofOn4ctUp8SEqfn7bmSgVABJaiuQXArvbVYqRNpsAVt8fvd3E2t09zL9VrAi24QWQ7rYmwmBlEscbU1NQycN8_mkdOs6ZQ1lWHvdBApBkxa_hEJhwicSfEUc222yc7o88rJp7mekbJPkMhYr5HfHRVJid4qCNfShBNw0.aU3X9tVJr8m1zFObcMNogw',
    expires_in: 3600,
    token_type: 'Bearer',
    sourceIP: '127.0.0.1',
};

describe('decode token test and authentication user', () => {
    const cognitoCredentials = new CognitoCredentials(payload);
    const decoded = cognitoCredentials.decodeToken;

    it('token decode must return an object', async () => {
        const objectKeys = Object.keys(decoded);
        expect(objectKeys.length).toBeGreaterThanOrEqual(0);
    });

    it('token decode must have a valid properties', async () => {
        expect(decoded).toHaveProperty('sub');
        expect(decoded).toHaveProperty('email');
    });

    it('Sub propertie value must be a valid uuid structure', async () => {
        const pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
        expect(decoded.sub).toMatch(pattern);
    });

    it('Email propertie value must be a valid email', async () => {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        expect(decoded.email).toMatch(emailPattern);
    });
});

describe('hash test', () => {
    const cognitoCredentials = new CognitoCredentials(payload);
    const repeatCognitoCredentials = new CognitoCredentials(payload);

    it('hash value must repeat value whith the same params', async () => {
        const hashCognitoCredentials = cognitoCredentials.hashCognitoResponse;
        const repeatHashCognitoCredentials = repeatCognitoCredentials.hashCognitoResponse;

        delete payload.sourceIP;

        const compareHashCognitoCredentials = PasswordEncoder.compareHash(
            JSON.stringify(payload),
            hashCognitoCredentials
        );

        const repeatCompareHashCognitoCredentials = PasswordEncoder.compareHash(
            JSON.stringify(payload),
            repeatHashCognitoCredentials
        );

        const sessionIdHashed = `${cognitoCredentials.decodeToken.email}:${cognitoCredentials.sourceIp}:${cognitoCredentials.decodeToken.sub}`;

        const hashSessionId = cognitoCredentials.hashSessionId;
        const repeatHashSessionId = repeatCognitoCredentials.hashSessionId;

        const compareHashSessionId = PasswordEncoder.compareHash(sessionIdHashed, hashSessionId);

        const repeatCompareHashSessionId = PasswordEncoder.compareHash(sessionIdHashed, repeatHashSessionId);

        expect(compareHashSessionId).toBe(true);
        expect(repeatCompareHashSessionId).toBe(true);

        expect(compareHashCognitoCredentials).toBe(true);
        expect(repeatCompareHashCognitoCredentials).toBe(true);
    });
});

describe('Authentication user', () => {
    const repository = new KnexAuthCognitoRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/auth-cognito`
            : `http://127.0.0.1:60004`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should authenticase user whit cognito credentials', async () => {
        let response;
        try {
            delete payload.sourceIP;
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (e) {
            console.log(e);
        }
        expect(response.status).toBe(200);
    });

    it('should return permissions with expected keys', async () => {
        let response;
        try {
            const clonePayload = { ...payload };
            delete clonePayload.sourceIP;
            response = await TestHelper.postRequest(baseUrl, clonePayload);
        } catch (e) {
            console.log(e);
        }

        const permissions = response?.data?.data?.permisions;
        expect(permissions).toBeDefined();
        expect(typeof permissions).toBe('object');

        const expectedKeys = ['agente', 'administrador', 'auxiliaries'];

        expect(Object.keys(permissions).sort()).toEqual(expectedKeys.sort());

        expectedKeys.forEach((key) => {
            expect(Array.isArray(permissions[key])).toBe(true);
            expect(permissions[key].length).toBeGreaterThan(0);
        });
    });
});

describe('CognitoCredentials - session_key uniqueness', () => {
    it('two instances with identical inputs must produce different session_keys', () => {
        const base = {
            id_token: payload.id_token,
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            expires_in: payload.expires_in,
            token_type: payload.token_type,
            sourceIp: '127.0.0.1',
            clientFingerprint: 'fingerprint-abc',
        };
        const a = new CognitoCredentials(base);
        const b = new CognitoCredentials(base);
        expect(a.session_key).not.toBe(b.session_key);
    });
});
